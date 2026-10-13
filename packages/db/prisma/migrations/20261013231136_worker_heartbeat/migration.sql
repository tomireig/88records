-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "host" TEXT,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);
