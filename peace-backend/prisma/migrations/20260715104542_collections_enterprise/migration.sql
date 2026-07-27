-- CreateEnum
CREATE TYPE "CollectionSort" AS ENUM ('MANUAL', 'BEST_SELLING', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST', 'OLDEST');

-- DropForeignKey
ALTER TABLE "_ProductCollections" DROP CONSTRAINT "_ProductCollections_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProductCollections" DROP CONSTRAINT "_ProductCollections_B_fkey";

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "sortOrder" "CollectionSort" NOT NULL DEFAULT 'MANUAL';

-- DropTable
DROP TABLE "_ProductCollections";

-- CreateTable
CREATE TABLE "CollectionProduct" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionProduct_collectionId_idx" ON "CollectionProduct"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionProduct_productId_idx" ON "CollectionProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionProduct_collectionId_productId_key" ON "CollectionProduct"("collectionId", "productId");

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

