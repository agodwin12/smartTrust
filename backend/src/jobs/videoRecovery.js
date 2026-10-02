const videoService = require("../services/video.service");

/** Video conversions lost to a server restart: mark them FAILED so the seller can upload again. */
module.exports = {
  name: "video-recovery",
  description: "Marks product videos stuck in processing as failed",
  intervalMs: 10 * 60 * 1000,
  async run() {
    return { failed: await videoService.failInterrupted() };
  },
};
