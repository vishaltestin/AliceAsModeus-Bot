-- Quota purchase ledger + plan validity

-- Accounts: add validity + currency
ALTER TABLE `accounts`
  ADD COLUMN `quotaValidUntil` DATETIME(3) NULL,
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR';

-- Quota purchase / transaction ledger
CREATE TABLE `quota_purchases` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `amountPaid` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `quotaBefore` INTEGER NOT NULL DEFAULT 0,
    `quotaAfter` INTEGER NOT NULL DEFAULT 0,
    `validityMonths` INTEGER NOT NULL DEFAULT 12,
    `validUntil` DATETIME(3) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quota_purchases_accountId_createdAt_idx`(`accountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quota_purchases` ADD CONSTRAINT `quota_purchases_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `quota_purchases` ADD CONSTRAINT `quota_purchases_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
