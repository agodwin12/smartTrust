-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VIDEO_READY';
ALTER TYPE "NotificationType" ADD VALUE 'VIDEO_FAILED';

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable: the old free-text video link (never shown, no rows use it) gives way to uploaded videos.
ALTER TABLE "advertisements" DROP COLUMN "video",
ADD COLUMN     "videoDuration" DOUBLE PRECISION,
ADD COLUMN     "videoError" TEXT,
ADD COLUMN     "videoHeight" INTEGER,
ADD COLUMN     "videoJobId" TEXT,
ADD COLUMN     "videoPosterUrl" TEXT,
ADD COLUMN     "videoStatus" "VideoStatus",
ADD COLUMN     "videoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "videoWidth" INTEGER;
