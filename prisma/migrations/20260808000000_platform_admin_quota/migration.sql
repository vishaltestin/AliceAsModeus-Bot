-- Platform admin + quota management

-- Add SUPER_ADMIN to the shared AccountRole enum used by both the users table
-- and the account_invitations table (Prisma stores enums inline on each column).
ALTER TABLE `account_invitations` MODIFY `role` ENUM('OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPER_ADMIN') NOT NULL;
ALTER TABLE `users` MODIFY `accountRole` ENUM('OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPER_ADMIN') NOT NULL DEFAULT 'AGENT';

-- Account: quota & status fields
ALTER TABLE `accounts`
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `planType` VARCHAR(191) NOT NULL DEFAULT 'FREE',
  ADD COLUMN `messageQuota` INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN `messagesUsed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `adminNotes` TEXT NULL;

CREATE INDEX `accounts_status_idx` ON `accounts`(`status`);
CREATE INDEX `accounts_planType_idx` ON `accounts`(`planType`);
CREATE INDEX `accounts_createdAt_idx` ON `accounts`(`createdAt`);

-- Message usage ledger
CREATE TABLE `message_usage_logs` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `feature` VARCHAR(191) NOT NULL,
    `recipientPhone` VARCHAR(191) NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SENT',
    `messageId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_usage_logs_accountId_createdAt_idx`(`accountId`, `createdAt`),
    INDEX `message_usage_logs_accountId_feature_createdAt_idx`(`accountId`, `feature`, `createdAt`),
    INDEX `message_usage_logs_feature_createdAt_idx`(`feature`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `message_usage_logs` ADD CONSTRAINT `message_usage_logs_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
