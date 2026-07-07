-- DropForeignKey
ALTER TABLE "device_events" DROP CONSTRAINT "device_events_device_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_device_event_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_device_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "push_tokens" DROP CONSTRAINT "push_tokens_user_id_fkey";

-- DropIndex
DROP INDEX "idx_device_events_device_created";

-- DropIndex
DROP INDEX "idx_notifications_device";

-- DropIndex
DROP INDEX "idx_notifications_user_created";

-- DropIndex
DROP INDEX "idx_notifications_user_read";

-- DropIndex
DROP INDEX "idx_training_captures_device_created";

-- DropIndex
DROP INDEX "idx_training_captures_label_created";

-- AlterTable
ALTER TABLE "device_events" ALTER COLUMN "payload" DROP DEFAULT;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "battery_percentage" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_user_read" ON "notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_device" ON "notifications"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_training_captures_device_created" ON "training_captures"("device_serial_number", "created_at");

-- CreateIndex
CREATE INDEX "idx_training_captures_label_created" ON "training_captures"("capture_label", "created_at");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_device_event_id_fkey" FOREIGN KEY ("device_event_id") REFERENCES "device_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_device_events_device" RENAME TO "device_events_device_id_idx";

-- RenameIndex
ALTER INDEX "idx_devices_connectivity" RENAME TO "devices_connectivity_status_idx";

-- RenameIndex
ALTER INDEX "idx_devices_operational" RENAME TO "devices_operational_status_idx";

-- RenameIndex
ALTER INDEX "idx_devices_serial" RENAME TO "devices_serial_number_idx";

-- RenameIndex
ALTER INDEX "idx_users_email" RENAME TO "users_email_idx";

-- RenameIndex
ALTER INDEX "idx_users_workos_id" RENAME TO "users_workos_user_id_idx";
