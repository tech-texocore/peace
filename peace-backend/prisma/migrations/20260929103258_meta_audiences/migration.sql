-- CreateTable
CREATE TABLE "MetaAudience" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "metaAudienceId" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaAudience_storeId_idx" ON "MetaAudience"("storeId");

-- AddForeignKey
ALTER TABLE "MetaAudience" ADD CONSTRAINT "MetaAudience_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

