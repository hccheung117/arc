CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider_id` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
