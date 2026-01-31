CREATE TABLE `apps` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`path` longtext NOT NULL,
	CONSTRAINT `apps_id` PRIMARY KEY(`id`)
);
