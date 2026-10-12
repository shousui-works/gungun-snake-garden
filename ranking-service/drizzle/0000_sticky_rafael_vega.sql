CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`difficulty` text NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL,
	`xp` integer NOT NULL,
	`score` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_owner_difficulty` ON `records` (`owner`,`difficulty`);--> statement-breakpoint
CREATE INDEX `records_ranking` ON `records` (`difficulty`,`score`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`difficulty` text NOT NULL,
	`started_at` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_owner_started` ON `runs` (`owner`,`started_at`);--> statement-breakpoint
CREATE INDEX `runs_expiry` ON `runs` (`started_at`);