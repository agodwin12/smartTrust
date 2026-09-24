const { S3Client } = require("@aws-sdk/client-s3");
const { r2 } = require("./env");

const r2Client = new S3Client({
  region: "auto",
  endpoint: r2.apiEndpoint,
  credentials: {
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
  },
});

module.exports = r2Client;
