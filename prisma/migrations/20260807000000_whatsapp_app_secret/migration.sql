-- AlterTable: add per-company Meta Developer App secret for webhook verification.
ALTER TABLE `whatsapp_configs` ADD COLUMN `metaAppSecretEncrypted` TEXT NULL;
