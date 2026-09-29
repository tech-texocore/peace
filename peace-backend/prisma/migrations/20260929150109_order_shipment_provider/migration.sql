-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shipmentProvider" TEXT;

-- Existing shipments were all booked through BharatShip.
UPDATE "Order" SET "shipmentProvider" = 'bharatship' WHERE "awb" IS NOT NULL;
