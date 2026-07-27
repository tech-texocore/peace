-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "codAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dispatchDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "replacementDays" INTEGER,
ADD COLUMN     "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "returnable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "supportPhone" TEXT,
ADD COLUMN     "warrantyInfo" TEXT;

