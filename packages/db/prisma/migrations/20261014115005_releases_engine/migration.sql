-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('uploading', 'analyzing', 'rendering', 'ready', 'failed');

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "audioKey" TEXT,
ADD COLUMN     "campaignProposedAt" TIMESTAMP(3),
ADD COLUMN     "coverKey" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "lyrics" TEXT,
ADD COLUMN     "status" "ReleaseStatus" NOT NULL DEFAULT 'uploading';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "aspect" TEXT,
ADD COLUMN     "campaignDay" INTEGER,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "renderParams" JSONB;
