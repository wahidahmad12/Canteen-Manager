CREATE TABLE `cipla_date_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`breakfast_coopen` int DEFAULT 0,
	`breakfast_coin` int DEFAULT 0,
	`breakfast_sign` int DEFAULT 0,
	`lunch_coopen` int DEFAULT 0,
	`lunch_coin` int DEFAULT 0,
	`lunch_sign` int DEFAULT 0,
	`dinner_coopen` int DEFAULT 0,
	`dinner_coin` int DEFAULT 0,
	`dinner_sign` int DEFAULT 0,
	`breakfast_machine` int DEFAULT 0,
	`lunch_machine` int DEFAULT 0,
	`dinner_machine` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `cipla_date_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cipla_machine_summary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`bf_machine` int DEFAULT 0,
	`lu_machine` int DEFAULT 0,
	`di_machine` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `cipla_machine_summary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_pnl_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`client_name` varchar(255) NOT NULL DEFAULT 'KPF',
	`breakfast_items` text,
	`lunch_items` text,
	`evening_items` text,
	`night_items` text,
	`manpower_items` text,
	`sale_items` text,
	`ps_sale_items` text,
	`other_expense` decimal(10,2) DEFAULT '0',
	`total_expense` decimal(10,2) DEFAULT '0',
	`total_sale` decimal(10,2) DEFAULT '0',
	`profit_loss` decimal(10,2) DEFAULT '0',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `daily_pnl_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hul_date_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(20) NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`breakfast` int DEFAULT 0,
	`lunch` int DEFAULT 0,
	`evening_snacks` int DEFAULT 0,
	`night_snacks` int DEFAULT 0,
	`guest_breakfast` int DEFAULT 0,
	`guest_lunch` int DEFAULT 0,
	`guest_evening_snacks` int DEFAULT 0,
	`guest_night_snacks` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `hul_date_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hul_kpf_exec_snacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`snacks` int DEFAULT 0,
	`biscuit` int DEFAULT 0,
	`chips` int DEFAULT 0,
	`cold_drink_water` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `hul_kpf_exec_snacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pankaj_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sl_no` int NOT NULL,
	`client_name` text NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`to_receive` decimal(12,2) NOT NULL DEFAULT '0',
	`gst_minus_tds` decimal(12,2) NOT NULL DEFAULT '0',
	`fixed_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`given_date` date,
	`given_amount` decimal(12,2),
	`payments` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `pankaj_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pec_ventures_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`red_label_qty` decimal(10,3) DEFAULT '0',
	`tata_tea_qty` decimal(10,3) DEFAULT '0',
	`coffee_qty` decimal(10,3) DEFAULT '0',
	`sugar_qty` decimal(10,3) DEFAULT '0',
	`ginger_qty` decimal(10,3) DEFAULT '0',
	`biscuit_qty` decimal(10,3) DEFAULT '0',
	`tea_cup_qty` decimal(10,3) DEFAULT '0',
	`green_elaychi_qty` decimal(10,3) DEFAULT '0',
	`green_tea_qty` decimal(10,3) DEFAULT '0',
	`black_salt_qty` decimal(10,3) DEFAULT '0',
	`milk_morning_qty` decimal(10,3) DEFAULT '0',
	`milk_evening_qty` decimal(10,3) DEFAULT '0',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `pec_ventures_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `pec_ventures_entries_entry_date_unique` UNIQUE(`entry_date`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`payment_date` varchar(10) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`notes` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `purchase_invoice_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`po_number` varchar(100) NOT NULL,
	`po_date` text NOT NULL,
	`po_amount` decimal(14,2) NOT NULL DEFAULT '0',
	`client_name` text NOT NULL,
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sl_no` int,
	`po_id` int,
	`client_name` text NOT NULL,
	`bill_date` text NOT NULL,
	`bill_number` varchar(100) NOT NULL,
	`bill_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`gst_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`gst_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`total_bill_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`tds_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`tds_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`payment_received_date` text,
	`payment_received_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`utr_no` varchar(100),
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `sales_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ubl_date_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`tea1` int DEFAULT 0,
	`biscuit1` int DEFAULT 0,
	`breakfast` int DEFAULT 0,
	`tea2` int DEFAULT 0,
	`lunch` int DEFAULT 0,
	`mutton` int DEFAULT 0,
	`tea3` int DEFAULT 0,
	`biscuit2` int DEFAULT 0,
	`tiffin` int DEFAULT 0,
	`boiled_egg` int DEFAULT 0,
	`tea4` int DEFAULT 0,
	`dinner` int DEFAULT 0,
	`tea5` int DEFAULT 0,
	`tea6` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `ubl_date_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ubl_lunch_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`perment` int DEFAULT 0,
	`casual` int DEFAULT 0,
	`contractual` int DEFAULT 0,
	`canteen` int DEFAULT 7,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `ubl_lunch_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unichem_lunch_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(100) NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`meal_type` varchar(20) NOT NULL DEFAULT 'lunch',
	`order_qty` int DEFAULT 0,
	`actual` int DEFAULT 0,
	`total` int DEFAULT 0,
	`bill_qty` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `unichem_lunch_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unichem_snack_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location` varchar(100) NOT NULL,
	`entry_date` date NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`week_day` varchar(10),
	`breakfast` int DEFAULT 0,
	`evening_snacks` int DEFAULT 0,
	`night_snacks` int DEFAULT 0,
	`sunday_extra_snacks` int DEFAULT 0,
	`remarks` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `unichem_snack_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_online_breakfast_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_online_lunch_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_online_evening_snacks_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_online_night_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_breakfast_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_lunch_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_evening_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_night_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_recharge_rate` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_recharge_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_breakfast_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_lunch_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_evening_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_night_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_ps_recharge_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_breakfast_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_veg_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_nv_rate` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_nv_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_egg_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_fish_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_chicken_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_evening_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_night_cash_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_breakfast_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_veg_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_nv_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_egg_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_fish_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_lunch_chicken_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_evening_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `cash_seals` ADD `income_tp_night_online_qty` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `client_names` ADD `state_name` varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE `client_names` ADD `state_code` varchar(10) DEFAULT '';--> statement-breakpoint
ALTER TABLE `daily_reports` ADD `give_by_wahid` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `employees` ADD `weekly_off_day` varchar(50) DEFAULT '';--> statement-breakpoint
ALTER TABLE `overtime_register` ADD `paid_date` date;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD `dj_invoice_no` varchar(20);--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD `pr_code` varchar(50);--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD `invoiced` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vendors` ADD `linked_clients` text;--> statement-breakpoint
ALTER TABLE `purchase_invoice_payments` ADD CONSTRAINT `purchase_invoice_payments_invoice_id_purchase_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON DELETE cascade ON UPDATE no action;