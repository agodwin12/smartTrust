const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, createUser, createStore, createCategory, createListing, login, as, DAY_MS } = require("./helpers");
const storage = require("../src/services/storage.service");
const videoService = require("../src/services/video.service");

const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]).status === 0;

// R2 stays untouched: uploads land in memory, deletions are recorded.
const uploaded = [];
const deleted = [];
storage.uploadFile = async (localPath, key, contentType) => {
  uploaded.push({ key, contentType, size: fs.statSync(localPath).size });
  return `https://cdn.test/${key}`;
};
storage.deleteImageByUrl = async (url) => {
  deleted.push(url);
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-video-test-"));
const ffmpeg = (...args) => {
  const res = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (res.status !== 0) throw new Error(String(res.stderr));
};
const fixture = (name) => path.join(dir, name);
const tmpFiles = () => (fs.existsSync(videoService.TMP_DIR) ? fs.readdirSync(videoService.TMP_DIR) : []);

describe("product videos", { skip: !hasFfmpeg && "ffmpeg is not installed" }, () => {
  let seller, other, cs, customer, ad;

  before(async () => {
    await resetDb();
    // A portrait phone-style clip (3 s, 1080x1920, with sound), one too long, and two fakes.
    ffmpeg("-f", "lavfi", "-i", "testsrc=duration=3:size=1080x1920:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", fixture("portrait.mov"));
    ffmpeg("-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=10", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixture("second.mp4"));
    ffmpeg("-f", "lavfi", "-i", "testsrc=duration=35:size=160x120:rate=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixture("long.mp4"));
    ffmpeg("-f", "lavfi", "-i", "testsrc=size=320x240", "-frames:v", "1", fixture("photo.jpg"));
    fs.copyFileSync(fixture("photo.jpg"), fixture("photo-renamed.mp4"));
    fs.writeFileSync(fixture("notes.mp4"), "definitely not a video");
    // Above 4K: refused before any decoding.
    ffmpeg("-f", "lavfi", "-i", "testsrc=duration=1.5:size=4200x120:rate=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixture("too-wide.mp4"));

    const [s, o, c, cu] = await Promise.all([createUser(), createUser(), createUser({ role: "CUSTOMER_SERVICE" }), createUser()]);
    seller = { ...s, ...(await login(s.user.email)) };
    other = { ...o, ...(await login(o.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    customer = { ...cu, ...(await login(cu.user.email)) };
    const { store } = await createStore(seller.user.id, { expiresAt: new Date(Date.now() + 30 * DAY_MS) });
    await createStore(other.user.id);
    ad = await createListing(store.id, (await createCategory()).id);
  });
  after(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await teardown();
  });

  const send = (token, file, id = ad.id) => as(token).post(`/api/advertisements/${id}/video`).attach("video", fixture(file));

  test("a seller uploads a short video: converted to a 720p MP4 with a poster, then shown on the listing", async () => {
    const before = tmpFiles();
    const res = await send(seller.token, "portrait.mov");
    assert.equal(res.status, 202, res.text);
    assert.equal(res.body.advertisement.videoStatus, "PROCESSING");
    assert.equal(res.body.advertisement.videoUrl, null, "nothing public until it is ready");

    await videoService.whenIdle();
    const row = await prisma.advertisement.findUnique({ where: { id: ad.id } });
    assert.equal(row.videoStatus, "READY", row.videoError ?? "");
    assert.match(row.videoUrl, /^https:\/\/cdn\.test\/.+\/advertisements\/videos\/.+\.mp4$/);
    assert.match(row.videoPosterUrl, /\.jpg$/);
    assert.deepEqual([row.videoWidth, row.videoHeight], [720, 1280], "portrait 1080x1920 scaled to 720x1280");
    assert.ok(row.videoDuration >= 2.5 && row.videoDuration <= 3.5, `duration ${row.videoDuration}`);
    assert.deepEqual(uploaded.map((u) => u.contentType), ["video/mp4", "image/jpeg"]);
    assert.deepEqual(tmpFiles(), before, "the original and the work files are deleted");

    const page = await request(app).get(`/api/advertisements/${ad.slug}`);
    assert.equal(page.body.advertisement.videoUrl, row.videoUrl);
    const note = await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "VIDEO_READY" } });
    assert.equal(note?.data.advertisementId, ad.id);
  });

  test("only one video per listing: a new upload replaces the previous one", async () => {
    const previous = await prisma.advertisement.findUnique({ where: { id: ad.id } });
    assert.equal((await send(seller.token, "second.mp4")).status, 202);
    assert.ok(deleted.includes(previous.videoUrl) && deleted.includes(previous.videoPosterUrl), "old files removed from storage");
    await videoService.whenIdle();
    const row = await prisma.advertisement.findUnique({ where: { id: ad.id } });
    assert.equal(row.videoStatus, "READY");
    assert.notEqual(row.videoUrl, previous.videoUrl);
    assert.deepEqual([row.videoWidth, row.videoHeight], [640, 360], "small videos keep their size");
  });

  test("videos over 30 seconds, photos and other files are refused, and nothing is kept", async () => {
    const before = tmpFiles();
    const long = await send(seller.token, "long.mp4");
    assert.equal(long.status, 422);
    assert.equal(long.body.code, "VIDEO_TOO_LONG");
    assert.match(long.body.error, /35 seconds/);
    for (const file of ["photo-renamed.mp4", "notes.mp4"]) {
      const res = await send(seller.token, file);
      assert.equal(res.status, 422, file);
      assert.equal(res.body.code, "UNSUPPORTED_VIDEO", file);
    }
    const photo = await send(seller.token, "photo.jpg");
    assert.equal(photo.body.code, "UNSUPPORTED_VIDEO", "rejected by type before upload");
    assert.deepEqual(tmpFiles(), before);
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } })).videoStatus, "READY", "the current video is untouched");
  });

  test("only the listing's seller can add a video", async () => {
    assert.equal((await send(other.token, "second.mp4")).status, 403);
    assert.equal((await send(customer.token, "second.mp4")).status, 404, "no store, no video");
    assert.equal((await request(app).post(`/api/advertisements/${ad.id}/video`)).status, 401);
    assert.equal((await as(other.token).delete(`/api/advertisements/${ad.id}/video`)).status, 403);
  });

  test("the seller can remove the video, and customer service can take one down", async () => {
    const res = await as(seller.token).delete(`/api/advertisements/${ad.id}/video`);
    assert.equal(res.status, 200);
    assert.equal(res.body.advertisement.videoUrl, null);
    assert.equal(res.body.advertisement.videoStatus, null);

    assert.equal((await send(seller.token, "second.mp4")).status, 202);
    await videoService.whenIdle();
    const byStaff = await as(cs.token).delete(`/api/advertisements/${ad.id}/video`);
    assert.equal(byStaff.status, 200);
    assert.equal(byStaff.body.advertisement.videoUrl, null);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "AD_VIDEO_REMOVED", entityId: ad.id, metadata: { path: ["byStaff"], equals: true } } }));
  });

  test("a conversion lost to a restart is marked failed so the seller can upload again", async () => {
    await prisma.advertisement.update({ where: { id: ad.id }, data: { videoStatus: "PROCESSING", videoJobId: "lost", videoUpdatedAt: new Date(Date.now() - 31 * 60 * 1000) } });
    assert.equal(await videoService.failInterrupted(), 1);
    const row = await prisma.advertisement.findUnique({ where: { id: ad.id } });
    assert.equal(row.videoStatus, "FAILED");
    assert.match(row.videoError, /upload the video again/);
  });

  test("security: playlists and scripts that point elsewhere are refused before ffmpeg reads them, and nothing is fetched", async () => {
    const hits = [];
    const internal = http.createServer((req, res) => {
      hits.push(req.url);
      res.end("secret");
    });
    await new Promise((resolve) => internal.listen(0, "127.0.0.1", resolve));
    const target = `http://127.0.0.1:${internal.address().port}`;
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${target}/internal.ts
#EXTINF:10.0,
file:///etc/passwd
#EXT-X-ENDLIST
`;
    const crafted = {
      "evil.m3u8": playlist, // the classic HLS trick, with the extension ffmpeg looks for
      "evil.mp4": playlist,
      "evil.ffconcat": `ffconcat version 1.0
file '${target}/via-concat.mp4'
`,
      "evil.sdp": `v=0
o=- 0 0 IN IP4 127.0.0.1
s=x
c=IN IP4 127.0.0.1
t=0 0
m=video 9 RTP/AVP 96
`,
    };
    try {
      for (const [name, body] of Object.entries(crafted)) {
        const res = await as(seller.token).post(`/api/advertisements/${ad.id}/video`).attach("video", Buffer.from(body), { filename: name, contentType: "video/mp4" });
        assert.equal(res.status, 422, name);
        assert.equal(res.body.code, "UNSUPPORTED_VIDEO", name);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.deepEqual(hits, [], "the server never fetched anything");
    } finally {
      internal.close();
    }
    // Even a file with a real video signature is read with a fixed demuxer and local files only.
    assert.ok(videoService.transcodeArgs("in", "out", "mov").join(" ").includes("-protocol_whitelist file -f mov -i in"));
  });

  test("security: videos above 4K are refused (a small file can claim a huge frame)", async () => {
    const res = await send(seller.token, "too-wide.mp4");
    assert.equal(res.status, 422);
    assert.equal(res.body.code, "VIDEO_RESOLUTION_TOO_HIGH");
  });

  test("a store can't flood the conversion queue: at most 3 videos processing at once", async () => {
    const { store } = await prisma.advertisement.findUnique({ where: { id: ad.id }, select: { store: true } });
    const category = await createCategory();
    const busy = [];
    for (let i = 0; i < 3; i += 1) busy.push(await createListing(store.id, category.id));
    await prisma.advertisement.updateMany({ where: { id: { in: busy.map((b) => b.id) } }, data: { videoStatus: "PROCESSING", videoJobId: "busy", videoUpdatedAt: new Date() } });
    const res = await send(seller.token, "second.mp4");
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "VIDEO_QUEUE_FULL");
    await prisma.advertisement.updateMany({ where: { id: { in: busy.map((b) => b.id) } }, data: { videoStatus: null, videoJobId: null } });
  });

  test("listings no longer take a video link", async () => {
    const res = await as(seller.token).patch(`/api/advertisements/${ad.id}`).send({ video: "https://youtube.com/watch?v=x" });
    assert.equal(res.status, 200);
    assert.equal("video" in res.body.advertisement, false);
  });
});
