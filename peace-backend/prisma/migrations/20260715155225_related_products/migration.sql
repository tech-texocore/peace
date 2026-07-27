-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "relatedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

