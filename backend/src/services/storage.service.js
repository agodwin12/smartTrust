const crypto = require("crypto");
const path = require("path");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const r2Client = require("../config/r2Client");
const { r2 } = require("../config/env");
const logger = require("../config/logger");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function buildKey(folder, originalName) {
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  return `${r2.keyPrefix}/${folder}/${uniqueName}`;
}

function keyToUrl(key) {
  return `${r2.publicUrl.replace(/\/$/, "")}/${key}`;
}

/** Reverses keyToUrl — returns null if the URL isn't one of ours (e.g. an external image link). */
function urlToKey(url) {
  const prefix = `${r2.publicUrl.replace(/\/$/, "")}/`;
  return url && url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * The mimetype multer reports is whatever the CLIENT put in the multipart header —
 * trivially spoofable. Someone could upload an HTML/SVG/script file labelled
 * image/png; since R2 serves it back publicly with the ContentType we set, that's
 * a stored-XSS/phishing vector waiting to happen. The file's first bytes can't be
 * faked without breaking it as an image, so this is what actually gets checked.
 */
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Uploads a single image buffer (from multer's memory storage) to R2 under
 * smart-market/<folder>/... and returns its public URL.
 */
async function uploadImage(file, folder) {
  const detectedType = detectImageType(file.buffer);

  if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
    const err = new Error("Only JPEG, PNG or WebP images are allowed.");
    err.status = 422;
    err.code = "UNSUPPORTED_FILE_TYPE";
    throw err;
  }
  // From here on, trust what the bytes say, not what the client claimed.
  file.mimetype = detectedType;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const err = new Error("Image must be smaller than 5MB.");
    err.status = 422;
    err.code = "FILE_TOO_LARGE";
    throw err;
  }

  const key = buildKey(folder, file.originalname);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return keyToUrl(key);
}

/** Best-effort cleanup — swallow errors so a storage hiccup never breaks the calling request. */
async function deleteImageByUrl(url) {
  const key = urlToKey(url);
  if (!key) return;

  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
  } catch (err) {
    logger.error({ key, err: err.message }, "Failed to delete R2 object");
  }
}

module.exports = { uploadImage, deleteImageByUrl, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
