-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "attributeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "path" TEXT,
ADD COLUMN     "variantAxisKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "maxOrderQty" INTEGER,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "minOrderQty" INTEGER,
ADD COLUMN     "returnWindowDays" INTEGER,
ADD COLUMN     "returnable" BOOLEAN,
ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "variantAxes" JSONB;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "color",
DROP COLUMN "fabric",
DROP COLUMN "pattern",
DROP COLUMN "size",
ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "heightCm" DECIMAL(6,2),
ADD COLUMN     "lengthCm" DECIMAL(6,2),
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" DECIMAL(6,2);

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

