-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "costPrice" DECIMAL(10,2);

