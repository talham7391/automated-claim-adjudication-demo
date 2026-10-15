CREATE TABLE `records` (
 `id` text PRIMARY KEY NOT NULL,
 `title` text NOT NULL,
 `status` text DEFAULT 'pending' NOT NULL,
 `effect_count` integer DEFAULT 0 NOT NULL
);
