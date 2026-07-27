-- CreateEnum
CREATE TYPE "DiscountMethod" AS ENUM ('AUTOMATIC', 'CODE');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'PRODUCTS', 'CATEGORIES', 'COLLECTIONS');

-- DropTable (Coupon is replaced by the unified Discount model)
DROP TABLE "Coupon";

-- Replace the old DiscountType enum (PERCENT/FIXED) with the new one
DROP TYPE "DiscountType";
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerGroupId" TEXT;

-- CreateTable
CREATE TABLE "CustomerGroup" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "DiscountMethod" NOT NULL DEFAULT 'AUTOMATIC',
    "code" TEXT,
    "type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "scope" "DiscountScope" NOT NULL DEFAULT 'ALL',
    "targetProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCollectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minSubtotal" DECIMAL(10,2),
    "minQuantity" INTEGER,
    "customerGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "getDiscountPercent" INTEGER,
    "tiers" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerGroup_storeId_idx" ON "CustomerGroup"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_storeId_slug_key" ON "CustomerGroup"("storeId", "slug");

-- CreateIndex
CREATE INDEX "Discount_storeId_method_idx" ON "Discount"("storeId", "method");

-- CreateIndex
CREATE INDEX "Discount_storeId_code_idx" ON "Discount"("storeId", "code");

-- CreateIndex
CREATE INDEX "DiscountUsage_discountId_userId_idx" ON "DiscountUsage"("discountId", "userId");

-- CreateIndex
CREATE INDEX "User_customerGroupId_idx" ON "User"("customerGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerGroupId_fkey" FOREIGN KEY ("customerGroupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerGroup" ADD CONSTRAINT "CustomerGroup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

