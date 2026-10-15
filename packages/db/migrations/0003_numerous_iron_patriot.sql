CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_uuid` text NOT NULL,
	`workflow` text NOT NULL,
	`inputs` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`error` text,
	`results` text,
	FOREIGN KEY (`session_uuid`) REFERENCES `sessions`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jobs_session_created_idx` ON `jobs` (`session_uuid`,`created_at`);--> statement-breakpoint
CREATE TABLE `workflow_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`step_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`error` text,
	`output` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_progress_job_step_idx` ON `workflow_progress` (`job_id`,`step_id`);