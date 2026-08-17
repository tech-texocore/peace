-- New columns for the refund/pickup lifecycle
ALTER TABLE "ReturnRequest"
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundAmount" DECIMAL(10,2),
  ADD COLUMN "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3);

-- Rework ReturnStatus enum: COMPLETED -> REFUNDED, add PICKED_UP
ALTER TYPE "ReturnStatus" RENAME TO "ReturnStatus_old";
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKED_UP', 'REFUNDED', 'REJECTED');
ALTER TABLE "ReturnRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ReturnRequest" ALTER COLUMN "status" TYPE "ReturnStatus"
  USING (CASE "status"::text WHEN 'COMPLETED' THEN 'REFUNDED' ELSE "status"::text END::"ReturnStatus");
ALTER TABLE "ReturnRequest" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
DROP TYPE "ReturnStatus_old";
