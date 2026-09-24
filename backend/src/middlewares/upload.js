const multer = require("multer");
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require("../services/storage.service");

// Memory storage: the file buffer goes straight to R2, never touches disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG or WebP images are allowed."));
    }
    cb(null, true);
  },
});

module.exports = upload;
