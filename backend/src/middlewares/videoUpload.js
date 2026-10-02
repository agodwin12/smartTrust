const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { TMP_DIR, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS } = require("../services/video.service");

fs.mkdirSync(TMP_DIR, { recursive: true });

// Disk storage: a phone video can be ~100 MB, far too big to hold in memory. The file is
// checked by ffprobe (real content, not the client's label), converted, then deleted.
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    // Our own name, never the uploader's extension: the format is decided by the file's bytes.
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.upload`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (file.mimetype?.startsWith("video/") || ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new ApiError(422, "Only video files (MP4, MOV, WebM) can be uploaded here.", "UNSUPPORTED_VIDEO"));
  },
});

/** Single "video" field, with a clear message when the file is over the size limit. */
function videoUpload(req, res, next) {
  upload.single("video")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(422, `Video must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Record in HD (1080p) rather than 4K, or trim it.`, "VIDEO_TOO_LARGE"));
    }
    next(err);
  });
}

module.exports = videoUpload;
