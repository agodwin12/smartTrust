const crypto = require("crypto");

/** SHA-256 hex digest — used to store refresh tokens at rest without keeping the raw, usable token. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** High-entropy opaque token for refresh tokens (not a JWT — nothing to decode, just a random secret). */
function randomToken(bytes = 64) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { sha256, randomToken };
