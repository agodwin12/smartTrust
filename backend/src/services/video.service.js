const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const storage = require("./storage.service");

/**
 * Product videos: one optional clip per listing, at most 30 seconds.
 *
 * The seller's file (phone videos: 1080p/4K, often HEVC that many browsers can't play) is
 * checked with ffprobe, then converted in the background by ffmpeg into one small, universal
 * MP4 (H.264/AAC, longest side 1280 px, metadata such as GPS location stripped, fast start for
 * streaming) plus a poster image. Only those two files go to R2; the original never leaves
 * the server and is deleted once processed. Jobs run one at a time at low CPU priority so the
 * website stays fast.
 */
const MAX_SECONDS = 30;
const MIN_SECONDS = 1;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TMP_DIR = path.join(os.tmpdir(), "smartplaze-videos");
// A job still PROCESSING this long after its upload was lost (e.g. the server restarted).
const STUCK_AFTER_MS = 30 * 60 * 1000;
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".3gp", ".mkv", ".avi"]);
// ffprobe format names of real video containers (an image would probe as image2/png_pipe/…).
const VIDEO_CONTAINERS = ["mov", "mp4", "matroska", "webm", "avi", "3gp"];
const FAILED_MESSAGE = "We couldn't process this video. Try another file (MP4 or MOV, up to 30 seconds).";
const INTERRUPTED_MESSAGE = "Processing was interrupted. Please upload the video again.";

const ffmpegPath = () => process.env.FFMPEG_PATH || "ffmpeg";
const ffprobePath = () => process.env.FFPROBE_PATH || "ffprobe";

/** Runs a command and resolves with its stdout; rejects with the end of stderr. */
function run(command, args, { timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    try {
      os.setPriority(child.pid, 10); // background work: the website keeps the CPU first
    } catch {
      /* not permitted here: run at normal priority */
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-8000)));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split("\n").slice(-3).join(" ") || `${command} exited with code ${code}`));
    });
  });
}

/** Duration, displayed size and audio presence of a video file, or null when it isn't a readable video. */
async function probe(file) {
  let info;
  try {
    info = JSON.parse(await run(ffprobePath(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { timeoutMs: 60 * 1000 }));
  } catch {
    return null;
  }
  const formatName = String(info.format?.format_name ?? "");
  if (!VIDEO_CONTAINERS.some((name) => formatName.split(",").includes(name))) return null;
  const video = (info.streams ?? []).find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  if (!video) return null;

  const duration = Number(info.format?.duration ?? video.duration);
  const rotation = Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const quarterTurn = Math.abs(rotation) % 180 === 90;
  return {
    duration: Number.isFinite(duration) ? duration : null,
    width: quarterTurn ? video.height : video.width,
    height: quarterTurn ? video.width : video.height,
    hasAudio: (info.streams ?? []).some((s) => s.codec_type === "audio"),
  };
}

/**
 * ffmpeg arguments for the published file: H.264 Main + AAC (plays everywhere), longest side
 * 1280 px, at most 30 fps and 30 s, no metadata (GPS location, device), fast start for streaming.
 */
function transcodeArgs(input, output) {
  // prettier-ignore
  return [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-t", String(MAX_SECONDS),
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-profile:v", "main", "-pix_fmt", "yuv420p", "-fpsmax", "30",
    "-c:a", "aac", "-b:a", "96k", "-ac", "2",
    "-map_metadata", "-1", "-map_chapters", "-1",
    "-movflags", "+faststart", "-threads", "2",
    output,
  ];
}

// One conversion at a time: the VPS also serves the site, and a queue keeps memory predictable.
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch((err) => logger.error({ err: err.message }, "video job crashed"));
  return queue;
}
/** Resolves once every queued conversion has finished (tests, graceful shutdown). */
const whenIdle = () => queue;

const EMPTY_VIDEO = { videoUrl: null, videoPosterUrl: null, videoDuration: null, videoWidth: null, videoHeight: null, videoError: null };

async function deleteFiles(...urls) {
  await Promise.all(urls.filter(Boolean).map((url) => storage.deleteImageByUrl(url)));
}

const bustListings = () => require("./advertisement.service").invalidateListingCache().catch(() => {});

/**
 * Takes the uploaded file (multer disk storage) for a listing the requester owns: checks it is a
 * real video of 1–30 seconds, replaces any previous video (one per listing) and queues the
 * conversion. The listing is returned with videoStatus PROCESSING.
 */
async function acceptUpload(ad, file) {
  try {
    const meta = await probe(file.path);
    if (!meta) throw new ApiError(422, "This file isn't a video we can read. Upload an MP4, MOV or WebM video.", "UNSUPPORTED_VIDEO");
    if (meta.duration !== null && meta.duration > MAX_SECONDS + 0.5) {
      throw new ApiError(422, `This video is ${Math.round(meta.duration)} seconds long. Videos can be up to ${MAX_SECONDS} seconds: trim it and upload it again.`, "VIDEO_TOO_LONG");
    }
    if (meta.duration !== null && meta.duration < MIN_SECONDS) throw new ApiError(422, "This video is too short.", "VIDEO_TOO_SHORT");
  } catch (err) {
    await fs.rm(file.path, { force: true });
    throw err;
  }

  const jobId = crypto.randomBytes(8).toString("hex");
  const updated = await prisma.advertisement.update({
    where: { id: ad.id },
    data: { ...EMPTY_VIDEO, videoStatus: "PROCESSING", videoJobId: jobId, videoUpdatedAt: new Date() },
  });
  // One video per listing: the new upload replaces the previous one.
  await deleteFiles(ad.videoUrl, ad.videoPosterUrl);
  if (ad.videoUrl) await bustListings();
  void enqueue(() => processJob(ad.id, jobId, file.path));
  return updated;
}

/** Converts one upload and publishes it, unless the listing got another video (or none) meanwhile. */
async function processJob(adId, jobId, input) {
  const output = path.join(TMP_DIR, `${jobId}.mp4`);
  const poster = path.join(TMP_DIR, `${jobId}.jpg`);
  const uploaded = [];
  try {
    await run(ffmpegPath(), transcodeArgs(input, output));
    const meta = await probe(output);
    if (!meta) throw new Error("the converted file is not a readable video");
    const at = Math.min(1, (meta.duration ?? 2) / 2).toFixed(2);
    await run(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", "-ss", at, "-i", output, "-frames:v", "1", "-q:v", "4", poster]);

    const name = storage.newKey("advertisements/videos", "");
    const videoUrl = await storage.uploadFile(output, `${name}.mp4`, "video/mp4");
    uploaded.push(videoUrl);
    const videoPosterUrl = await storage.uploadFile(poster, `${name}.jpg`, "image/jpeg");
    uploaded.push(videoPosterUrl);

    const { count } = await prisma.advertisement.updateMany({
      where: { id: adId, videoJobId: jobId },
      data: {
        videoStatus: "READY",
        videoUrl,
        videoPosterUrl,
        videoDuration: meta.duration !== null ? Math.round(meta.duration * 10) / 10 : null,
        videoWidth: meta.width ?? null,
        videoHeight: meta.height ?? null,
        videoError: null,
        videoUpdatedAt: new Date(),
      },
    });
    if (count === 0) return deleteFiles(...uploaded); // replaced or removed while converting
    await bustListings();
    await notifyOwner(adId, "VIDEO_READY");
  } catch (err) {
    logger.warn({ adId, err: err.message }, "video conversion failed");
    await deleteFiles(...uploaded);
    const { count } = await prisma.advertisement.updateMany({
      where: { id: adId, videoJobId: jobId },
      data: { ...EMPTY_VIDEO, videoStatus: "FAILED", videoError: FAILED_MESSAGE, videoUpdatedAt: new Date() },
    });
    if (count > 0) await notifyOwner(adId, "VIDEO_FAILED");
  } finally {
    await Promise.all([input, output, poster].map((file) => fs.rm(file, { force: true })));
  }
}

async function notifyOwner(adId, type) {
  try {
    const ad = await prisma.advertisement.findUnique({ where: { id: adId }, select: { id: true, title: true, store: { select: { ownerId: true } } } });
    if (!ad) return;
    await prisma.notification.create({
      data: {
        userId: ad.store.ownerId,
        type,
        title: type === "VIDEO_READY" ? `Your video for "${ad.title}" is live` : `Your video for "${ad.title}" could not be processed`,
        body: type === "VIDEO_READY" ? null : FAILED_MESSAGE,
        data: { advertisementId: ad.id, productTitle: ad.title },
      },
    });
  } catch (err) {
    logger.warn({ adId, err: err.message }, "[notifications] video event failed");
  }
}

/** Removes the listing's video (seller or staff). Any conversion still running is discarded. */
async function remove(ad) {
  const updated = await prisma.advertisement.update({
    where: { id: ad.id },
    data: { ...EMPTY_VIDEO, videoStatus: null, videoJobId: null, videoUpdatedAt: new Date() },
  });
  await deleteFiles(ad.videoUrl, ad.videoPosterUrl);
  await bustListings();
  return updated;
}

/** Background job: conversions lost to a restart are marked FAILED so the seller can upload again. */
async function failInterrupted(now = new Date()) {
  const { count } = await prisma.advertisement.updateMany({
    where: { videoStatus: "PROCESSING", videoUpdatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { videoStatus: "FAILED", videoError: INTERRUPTED_MESSAGE },
  });
  return count;
}

module.exports = {
  MAX_SECONDS,
  MAX_UPLOAD_BYTES,
  TMP_DIR,
  ALLOWED_EXTENSIONS,
  probe,
  transcodeArgs,
  run,
  acceptUpload,
  remove,
  failInterrupted,
  whenIdle,
};
