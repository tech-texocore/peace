-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "customization" JSONB;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customization" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "customizationFields" JSONB,
ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MasterList" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterList_storeId_idx" ON "MasterList"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterList_storeId_key_key" ON "MasterList"("storeId", "key");

-- CreateIndex
CREATE INDEX "MasterItem_listId_idx" ON "MasterItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItem_listId_value_key" ON "MasterItem"("listId", "value");

-- AddForeignKey
ALTER TABLE "MasterList" ADD CONSTRAINT "MasterList_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MasterList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

