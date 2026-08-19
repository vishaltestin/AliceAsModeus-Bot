-- CreateTable
CREATE TABLE `contact_categories` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#1D5CC8',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contact_categories_accountId_name_key`(`accountId`, `name`),
    INDEX `contact_categories_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contact_categories` ADD CONSTRAINT `contact_categories_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default categories for every existing account so nothing breaks on upgrade.
INSERT INTO `contact_categories` (`id`, `accountId`, `name`, `color`, `createdAt`)
SELECT UUID(), a.`id`, c.`name`, c.`color`, CURRENT_TIMESTAMP(3)
FROM (
    SELECT 'LEAD' AS `name`, '#1D5CC8' AS `color`
    UNION SELECT 'PROSPECT', '#3E7DE0'
    UNION SELECT 'CUSTOMER', '#6FA3F0'
    UNION SELECT 'VIP', '#0A3B9E'
    UNION SELECT 'OTHER', '#3C3C3C'
) AS c
CROSS JOIN `accounts` AS a;
