-- Add a flexible contact category for filtering and segmentation.
ALTER TABLE `contacts` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'LEAD';

CREATE INDEX `contacts_accountId_category_idx` ON `contacts`(`accountId`, `category`);
