-- Android export (2026-10-18, docs/android-export-design.md §8): a game's Android identity (AndroidApp), its
-- upload keystore encrypted under ANDROID_KEY_MASTER (AndroidKey) and its builds (AndroidBuild). Nothing
-- existing changes; deleting a project cascades to all three.

-- CreateEnum
CREATE TYPE "AndroidFormat" AS ENUM ('apk', 'aab');

-- CreateEnum
CREATE TYPE "AndroidBuildStatus" AS ENUM ('queued', 'running', 'signing', 'done', 'failed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "AndroidApp" (
    "projectId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL DEFAULT 0,
    "packageLockedAt" TIMESTAMP(3),
    "iconPng" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AndroidApp_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "AndroidKey" (
    "projectId" TEXT NOT NULL,
    "alias" TEXT NOT NULL DEFAULT 'upload',
    "certSha256" TEXT NOT NULL,
    "blob" BYTEA NOT NULL,
    "keyId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "downloads" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AndroidKey_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "AndroidBuild" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionN" INTEGER NOT NULL,
    "commit" TEXT NOT NULL,
    "format" "AndroidFormat" NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "versionName" TEXT NOT NULL,
    "status" "AndroidBuildStatus" NOT NULL DEFAULT 'queued',
    "failCode" TEXT,
    "failMessage" TEXT,
    "logTail" TEXT,
    "path" TEXT,
    "bytes" INTEGER,
    "sha256" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'placeholder',
    "checks" JSONB,
    "godotVersion" TEXT NOT NULL,
    "toolchain" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AndroidBuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AndroidApp_packageName_key" ON "AndroidApp"("packageName");

-- CreateIndex
CREATE INDEX "AndroidBuild_projectId_queuedAt_idx" ON "AndroidBuild"("projectId", "queuedAt");

-- CreateIndex
CREATE INDEX "AndroidBuild_status_queuedAt_idx" ON "AndroidBuild"("status", "queuedAt");

-- AddForeignKey
ALTER TABLE "AndroidApp" ADD CONSTRAINT "AndroidApp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndroidKey" ADD CONSTRAINT "AndroidKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AndroidApp"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndroidBuild" ADD CONSTRAINT "AndroidBuild_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AndroidApp"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

