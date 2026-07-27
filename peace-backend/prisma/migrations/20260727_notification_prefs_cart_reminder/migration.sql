-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" JSONB;

