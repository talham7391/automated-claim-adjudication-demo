CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_uuid_unique` ON `sessions` (`uuid`);