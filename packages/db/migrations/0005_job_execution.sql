-- Preserve public UUIDs while moving jobs and step references to integer row IDs.
CREATE TABLE `jobs_new` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `uuid` text NOT NULL,
    `session_id` text NOT NULL,
    `inputs` text NOT NULL,
    `workflow` text NOT NULL,
    `status` text DEFAULT 'queued' NOT NULL,
    `created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
    `updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
    `started_at` integer,
    `completed_at` integer,
    `error` text,
    `results` text,
    FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`)
);
--> statement-breakpoint
INSERT INTO `jobs_new` (`uuid`, `session_id`, `inputs`, `workflow`, `status`, `created_at`, `updated_at`, `started_at`, `completed_at`, `error`, `results`)
SELECT j.id, cast(s.id as text), j.inputs, j.workflow, j.status, j.created_at, j.updated_at, j.started_at, j.completed_at, j.error, j.results
FROM `jobs` j JOIN `sessions` s ON s.uuid = j.session_uuid
ORDER BY j.created_at, j.id;
--> statement-breakpoint
CREATE TABLE `job_steps` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `job_id` text NOT NULL,
    `step_id` text NOT NULL,
    `sequence` integer NOT NULL,
    `status` text DEFAULT 'pending' NOT NULL,
    `started_at` integer,
    `completed_at` integer,
    `error` text,
    `output` text,
    FOREIGN KEY (`job_id`) REFERENCES `jobs_new`(`id`)
);
--> statement-breakpoint
INSERT INTO `job_steps` (`id`, `job_id`, `step_id`, `sequence`, `status`, `started_at`, `completed_at`, `error`, `output`)
SELECT p.id, cast(j.id as text), p.step_id, p.position, p.status, p.started_at, p.completed_at, p.error, p.output
FROM `workflow_progress` p JOIN `jobs_new` j ON j.uuid = p.job_id;
--> statement-breakpoint
DROP TABLE `workflow_progress`;
--> statement-breakpoint
DROP TABLE `jobs`;
--> statement-breakpoint
ALTER TABLE `jobs_new` RENAME TO `jobs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_uuid_unique` ON `jobs` (`uuid`);
--> statement-breakpoint
CREATE INDEX `jobs_session_id_idx` ON `jobs` (`session_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_steps_job_step_idx` ON `job_steps` (`job_id`, `step_id`);
