CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_pin` varchar(500) NOT NULL DEFAULT '1234',
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `advances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`date` date NOT NULL,
	`amount` decimal(10,2) DEFAULT '0',
	`purpose` varchar(500) DEFAULT '',
	`installments` int DEFAULT 1,
	`recovered_amount` decimal(10,2) DEFAULT '0',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `advances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`day1` text,
	`day2` text,
	`day3` text,
	`day4` text,
	`day5` text,
	`day6` text,
	`day7` text,
	`day8` text,
	`day9` text,
	`day10` text,
	`day11` text,
	`day12` text,
	`day13` text,
	`day14` text,
	`day15` text,
	`day16` text,
	`day17` text,
	`day18` text,
	`day19` text,
	`day20` text,
	`day21` text,
	`day22` text,
	`day23` text,
	`day24` text,
	`day25` text,
	`day26` text,
	`day27` text,
	`day28` text,
	`day29` text,
	`day30` text,
	`day31` text,
	`total_present` decimal(5,1) DEFAULT '0',
	`total_absent` decimal(5,1) DEFAULT '0',
	`overtime_hours` decimal(6,2) DEFAULT '0',
	`remarks` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `biscuit_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventory_id` int NOT NULL,
	`name` text NOT NULL,
	`exp_date` varchar(500) DEFAULT '',
	`brand` varchar(500) DEFAULT '',
	`given` decimal(10,2) DEFAULT '0',
	`used` decimal(10,2) DEFAULT '0',
	`balance` decimal(10,2) DEFAULT '0',
	CONSTRAINT `biscuit_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonus_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_name` text NOT NULL,
	`fy_start_year` int NOT NULL,
	`bonus_date` text,
	`working_days` text,
	`ref_number` text,
	`letter_date` text,
	`form_d_nature_of_industry` text,
	`form_d_employer_name` text,
	`form_d_settlement` text,
	`form_d_percentage` text,
	`form_d_paid_to_all` text,
	`form_d_remarks` text,
	`form_d_payment_date` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `bonus_returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_seals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serial_number` int,
	`report_id` int NOT NULL,
	`income_morning_qty` decimal(10,2) DEFAULT '0',
	`income_lunch_qty` decimal(10,2) DEFAULT '0',
	`income_evening_qty` decimal(10,2) DEFAULT '0',
	`income_night_qty` decimal(10,2) DEFAULT '0',
	`income_non_veg_rate` decimal(10,2) DEFAULT '0',
	`income_non_veg_qty` decimal(10,2) DEFAULT '0',
	`income_veg_rate` decimal(10,2) DEFAULT '0',
	`income_veg_qty` decimal(10,2) DEFAULT '0',
	`income_morning_cash_rate` decimal(10,2) DEFAULT '0',
	`income_morning_cash_qty` decimal(10,2) DEFAULT '0',
	`income_evening_cash_rate` decimal(10,2) DEFAULT '0',
	`income_evening_cash_qty` decimal(10,2) DEFAULT '0',
	`expense_banana_qty` decimal(10,2) DEFAULT '0',
	`expense_dahi_bhar_qty` decimal(10,2) DEFAULT '0',
	`expense_dahi_bhar_rate` decimal(10,2) DEFAULT '0',
	`expense_other_amount` decimal(10,2) DEFAULT '0',
	`total_given_to_akbar_ali` decimal(10,2) DEFAULT '0',
	CONSTRAINT `cash_seals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_names` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(500) DEFAULT '',
	`gst_no` varchar(500) DEFAULT '',
	`agreement_valid_till` date,
	CONSTRAINT `client_names_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_names_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `daily_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serial_number` int,
	`date` date NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `daily_inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_inventory_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `daily_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_number` int,
	`date` date NOT NULL,
	`opening_balance` decimal(10,2) NOT NULL DEFAULT '0',
	`received_amount` decimal(10,2) NOT NULL DEFAULT '0',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `daily_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_reports_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `damage_deductions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`date` date NOT NULL,
	`amount` decimal(10,2) DEFAULT '0',
	`description` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `damage_deductions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_wage_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`calendar_year` int NOT NULL,
	`daily_rate` decimal(10,2) NOT NULL DEFAULT '0',
	`effective_from` varchar(500) DEFAULT '',
	`remarks` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `employee_wage_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_code` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`father_name` varchar(500) DEFAULT '',
	`designation` varchar(500) DEFAULT '',
	`department` varchar(500) DEFAULT '',
	`client_name` text NOT NULL,
	`esic_no` varchar(500) DEFAULT '',
	`pf_no` varchar(500) DEFAULT '',
	`uan_no` varchar(500) DEFAULT '',
	`aadhaar_no` varchar(500) DEFAULT '',
	`pan_no` varchar(500) DEFAULT '',
	`bank_name` varchar(500) DEFAULT '',
	`account_no` varchar(500) DEFAULT '',
	`ifsc_code` varchar(500) DEFAULT '',
	`daily_rate` decimal(10,2) DEFAULT '0',
	`fixed_hra` decimal(10,2) DEFAULT '0',
	`gender` varchar(500) DEFAULT 'Male',
	`dob` date,
	`address` varchar(500) DEFAULT '',
	`permanent_address` varchar(500) DEFAULT '',
	`local_address` varchar(500) DEFAULT '',
	`skills` varchar(500) DEFAULT '',
	`joining_date` date,
	`leaving_date` date,
	`leaving_reason` varchar(500) DEFAULT '',
	`mobile` varchar(500) DEFAULT '',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employee_code_unique` UNIQUE(`employee_code`)
);
--> statement-breakpoint
CREATE TABLE `expense_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_id` int NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`uom` text NOT NULL,
	`qty` decimal(10,2) DEFAULT '0',
	`rate` decimal(10,2) DEFAULT '0',
	`amount` decimal(10,2) DEFAULT '0',
	CONSTRAINT `expense_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`date` date NOT NULL,
	`amount` decimal(10,2) DEFAULT '0',
	`reason` varchar(500) DEFAULT '',
	`realized` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `fines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `half_yearly_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_name` text NOT NULL,
	`half_year` text NOT NULL,
	`year` int NOT NULL,
	`ref_number` text,
	`letter_date` text,
	`form_date` text,
	`contract_from` text,
	`contract_to` text,
	`principal_days` text,
	`contractor_days` text,
	`daily_hours` text,
	`weekly_holiday` text,
	`holiday_paid` text,
	`lwf_men` text,
	`lwf_women` text,
	`canteen` text,
	`rest_room` text,
	`drinking_water` text,
	`creches` text,
	`first_aid` text,
	`licence_no` text,
	`principal_address` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `half_yearly_returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_master` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_name` varchar(255) NOT NULL,
	`uom` varchar(500) NOT NULL DEFAULT 'Kg',
	`rate` decimal(10,2) DEFAULT '0',
	`hsn_code` varchar(500) NOT NULL DEFAULT '',
	`gst_percent` decimal(5,2) DEFAULT '0',
	`item_type` varchar(500) NOT NULL DEFAULT 'purchase',
	`item_category` varchar(500) NOT NULL DEFAULT 'General',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `item_master_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_master_item_name_unique` UNIQUE(`item_name`)
);
--> statement-breakpoint
CREATE TABLE `kitchen_stock_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventory_id` int NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`open` decimal(10,2) DEFAULT '0',
	`used` decimal(10,2) DEFAULT '0',
	`balance` decimal(10,2) DEFAULT '0',
	`remarks` varchar(500) DEFAULT '',
	CONSTRAINT `kitchen_stock_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_with_wages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`calendar_year` int NOT NULL,
	`days_leave_earned` decimal(6,1) DEFAULT '0',
	`days_leave_brought_forward` decimal(6,1) DEFAULT '0',
	`lay_off_days` decimal(6,1) DEFAULT '0',
	`maternity_leave_days` decimal(6,1) DEFAULT '0',
	`leave_earned` decimal(6,1) DEFAULT '0',
	`leave_enjoyed` decimal(6,1) DEFAULT '0',
	`other_absence_days` decimal(6,1) DEFAULT '0',
	`actual_days_worked` decimal(6,1) DEFAULT '0',
	`leave_allowed_date` varchar(500) DEFAULT 'NA',
	`leave_allowed_days` varchar(500) DEFAULT 'NA',
	`rate_of_wages_rs` decimal(10,2) DEFAULT '0',
	`rate_of_wages_p` decimal(4,0) DEFAULT '0',
	`amount_of_wages_rs` decimal(10,2) DEFAULT '0',
	`amount_of_wages_p` decimal(4,0) DEFAULT '0',
	`date_of_payment` varchar(500) DEFAULT '',
	`remarks` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `leave_with_wages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serial_number` int,
	`ref_number` text NOT NULL,
	`letter_date` text NOT NULL,
	`to_name` text,
	`to_address` text,
	`to_gstin` text,
	`subject` text,
	`body` text,
	`regards` text,
	`client_name` text,
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `letters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `overtime_register` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`date` date NOT NULL,
	`normal_hours` decimal(5,2) DEFAULT '8',
	`overtime_hours` decimal(5,2) DEFAULT '0',
	`overtime_rate` decimal(10,2) DEFAULT '0',
	`overtime_amount` decimal(12,2) DEFAULT '0',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `overtime_register_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`item_name` text NOT NULL,
	`uom` text NOT NULL,
	`qty` decimal(10,2) DEFAULT '0',
	`unit_price` decimal(10,2) DEFAULT '0',
	`total_price` decimal(12,2) DEFAULT '0',
	`gst_rate` decimal(5,2) DEFAULT '0',
	`gst_amount` decimal(12,2) DEFAULT '0',
	`net_amount` decimal(12,2) DEFAULT '0',
	CONSTRAINT `purchase_invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serial_number` int,
	`purchase_request_id` int,
	`client_name` text NOT NULL,
	`vendor_name` text NOT NULL,
	`vendor_invoice_no` varchar(500) NOT NULL DEFAULT '',
	`date` date NOT NULL,
	`total_amount` decimal(12,2) DEFAULT '0',
	`total_gst` decimal(12,2) DEFAULT '0',
	`grand_total` decimal(12,2) DEFAULT '0',
	`payment_given` boolean NOT NULL DEFAULT false,
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `purchase_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`item_name` text NOT NULL,
	`uom` text NOT NULL,
	`request_qty` decimal(10,2) DEFAULT '0',
	`approve_qty` decimal(10,2),
	`approved` boolean NOT NULL DEFAULT false,
	CONSTRAINT `purchase_request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serial_number` int,
	`client_name` text NOT NULL,
	`date` date NOT NULL,
	`status` varchar(500) NOT NULL DEFAULT 'pending',
	`created_by` text,
	`approved_by` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `purchase_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salary_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`client_name` text NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`days_worked` decimal(5,1) DEFAULT '0',
	`basic_wage` decimal(12,2) DEFAULT '0',
	`da` decimal(12,2) DEFAULT '0',
	`hra` decimal(12,2) DEFAULT '0',
	`other_allowance` decimal(12,2) DEFAULT '0',
	`gross_wage` decimal(12,2) DEFAULT '0',
	`pf_deduction` decimal(12,2) DEFAULT '0',
	`esic_deduction` decimal(12,2) DEFAULT '0',
	`professional_tax` decimal(12,2) DEFAULT '0',
	`advance_deduction` decimal(12,2) DEFAULT '0',
	`fine_deduction` decimal(12,2) DEFAULT '0',
	`lwf` decimal(12,2) DEFAULT '0',
	`other_deduction` decimal(12,2) DEFAULT '0',
	`total_deduction` decimal(12,2) DEFAULT '0',
	`net_pay` decimal(12,2) DEFAULT '0',
	`overtime_hours` decimal(6,2) DEFAULT '0',
	`overtime_rate` decimal(10,2) DEFAULT '0',
	`overtime_amount` decimal(12,2) DEFAULT '0',
	`payment_mode` varchar(500) DEFAULT 'Bank Transfer',
	`paid_on` date,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `salary_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_item_names` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`source` varchar(500) NOT NULL DEFAULT 'purchase',
	`category_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `saved_item_names_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_item_names_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `saved_menus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_name` text NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`menu_data` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `saved_menus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_wage_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skill_category` text NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`daily_rate` decimal(10,2) NOT NULL DEFAULT '0',
	`remarks` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `skill_wage_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` varchar(500) NOT NULL DEFAULT 'user',
	`client_name` text,
	`permissions` json NOT NULL DEFAULT ('["expense","cashseal","inventory","menu"]'),
	`employee_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `vegetable_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `vegetable_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `vegetable_items_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(500) DEFAULT '',
	`address` varchar(500) DEFAULT '',
	`gst_no` varchar(500) DEFAULT '',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendors_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `advances` ADD CONSTRAINT `advances_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `biscuit_items` ADD CONSTRAINT `biscuit_items_inventory_id_daily_inventory_id_fk` FOREIGN KEY (`inventory_id`) REFERENCES `daily_inventory`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_seals` ADD CONSTRAINT `cash_seals_report_id_daily_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `damage_deductions` ADD CONSTRAINT `damage_deductions_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_wage_rates` ADD CONSTRAINT `employee_wage_rates_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_items` ADD CONSTRAINT `expense_items_report_id_daily_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `daily_reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fines` ADD CONSTRAINT `fines_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kitchen_stock_items` ADD CONSTRAINT `kitchen_stock_items_inventory_id_daily_inventory_id_fk` FOREIGN KEY (`inventory_id`) REFERENCES `daily_inventory`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_with_wages` ADD CONSTRAINT `leave_with_wages_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `overtime_register` ADD CONSTRAINT `overtime_register_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_invoice_id_purchase_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_purchase_request_id_purchase_requests_id_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_request_items` ADD CONSTRAINT `purchase_request_items_request_id_purchase_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salary_records` ADD CONSTRAINT `salary_records_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;