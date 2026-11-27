import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import {
  ciplaDateEntries, hulDateEntries, hulKpfExecSnacks, ublDateEntries, ublLunchEntries,
  unichEmLunchEntries, unichEmSnackEntries,
} from "../shared/schema";
import { saveDailyEntry, saveUblContractorMeals } from "./daily-entry-save";

const url = process.env.DAILY_ENTRY_TEST_DATABASE_URL;
const pool = url ? mysql.createPool({ uri: url, dateStrings: true, connectionLimit: 12 }) : null;
const options = { skip: !pool && "Set DAILY_ENTRY_TEST_DATABASE_URL to an empty disposable MySQL database" };

before(async () => {
  if (!pool) return;
  await pool.query(`CREATE TABLE daily_entry_locks (
    form_name VARCHAR(80) NOT NULL, entry_date DATE NOT NULL, scope1 VARCHAR(100) NOT NULL, scope2 VARCHAR(20) NOT NULL,
    PRIMARY KEY (form_name, entry_date, scope1, scope2))`);
  await pool.query(`CREATE TABLE ubl_date_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, entry_date DATE NOT NULL, month INT NOT NULL, year INT NOT NULL,
    week_day VARCHAR(10), tea1 INT DEFAULT 0, biscuit1 INT DEFAULT 0, breakfast INT DEFAULT 0,
    contractor_breakfast INT DEFAULT 0, tea2 INT DEFAULT 0, lunch INT DEFAULT 0, mutton INT DEFAULT 0,
    tea3 INT DEFAULT 0, biscuit2 INT DEFAULT 0, tiffin INT DEFAULT 0, boiled_egg INT DEFAULT 0,
    tea4 INT DEFAULT 0, dinner INT DEFAULT 0, tea5 INT DEFAULT 0, tea6 INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE ubl_f3_meal_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, entry_date VARCHAR(10) NOT NULL, contractor_id INT NOT NULL,
    meal_type VARCHAR(20) NOT NULL, qty INT NOT NULL, UNIQUE KEY (entry_date, contractor_id, meal_type))`);
  await pool.query(`CREATE TABLE unichem_lunch_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, location VARCHAR(100) NOT NULL, entry_date DATE NOT NULL,
    month INT NOT NULL, year INT NOT NULL, week_day VARCHAR(10), meal_type VARCHAR(20) NOT NULL,
    order_qty INT DEFAULT 0, actual INT DEFAULT 0, total INT DEFAULT 0, bill_qty INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE ubl_lunch_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, entry_date DATE NOT NULL, month INT NOT NULL, year INT NOT NULL,
    week_day VARCHAR(10), perment INT DEFAULT 0, casual INT DEFAULT 0, contractual INT DEFAULT 0,
    canteen INT DEFAULT 7, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE cipla_date_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, entry_date DATE NOT NULL, month INT NOT NULL, year INT NOT NULL,
    week_day VARCHAR(10), breakfast_coopen INT DEFAULT 0, breakfast_coin INT DEFAULT 0, breakfast_sign INT DEFAULT 0,
    lunch_coopen INT DEFAULT 0, lunch_coin INT DEFAULT 0, lunch_sign INT DEFAULT 0,
    dinner_coopen INT DEFAULT 0, dinner_coin INT DEFAULT 0, dinner_sign INT DEFAULT 0,
    breakfast_machine INT DEFAULT 0, lunch_machine INT DEFAULT 0, dinner_machine INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE unichem_snack_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, location VARCHAR(100) NOT NULL, entry_date DATE NOT NULL,
    month INT NOT NULL, year INT NOT NULL, week_day VARCHAR(10), breakfast INT DEFAULT 0,
    evening_snacks INT DEFAULT 0, night_snacks INT DEFAULT 0, sunday_extra_snacks INT DEFAULT 0,
    remarks VARCHAR(500) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE hul_date_entries (
    id INT AUTO_INCREMENT PRIMARY KEY, location VARCHAR(20) NOT NULL, entry_date DATE NOT NULL,
    month INT NOT NULL, year INT NOT NULL, week_day VARCHAR(10), breakfast INT DEFAULT 0, lunch INT DEFAULT 0,
    evening_snacks INT DEFAULT 0, night_snacks INT DEFAULT 0, guest_breakfast INT DEFAULT 0,
    guest_lunch INT DEFAULT 0, guest_evening_snacks INT DEFAULT 0, guest_night_snacks INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE hul_kpf_exec_snacks (
    id INT AUTO_INCREMENT PRIMARY KEY, entry_date DATE NOT NULL, month INT NOT NULL, year INT NOT NULL,
    week_day VARCHAR(10), snacks INT DEFAULT 0, biscuit INT DEFAULT 0, chips INT DEFAULT 0,
    cold_drink_water INT DEFAULT 0, shift_officer_breakfast INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
});

after(async () => { await pool?.end(); });

test("all daily form tables replace a second save for the same date", options, async () => {
  assert.ok(pool);
  const cases = [
    { table: ublLunchEntries, scope: [], field: "perment" },
    { table: ciplaDateEntries, scope: [], field: "breakfastCoopen" },
    { table: unichEmSnackEntries, scope: ["location"], field: "breakfast" },
    { table: hulDateEntries, scope: ["location"], field: "lunch" },
    { table: hulKpfExecSnacks, scope: [], field: "snacks" },
  ];
  for (const config of cases) {
    const data = { entryDate: "2026-10-21", month: 10, year: 2026, location: "KPF", [config.field]: 3 };
    const first = await saveDailyEntry<{ id: number }>(pool, config, data);
    const second = await saveDailyEntry<Record<string, number>>(pool, config, { ...data, [config.field]: 8 });
    assert.equal(second.id, first.id);
    assert.equal(second[config.field], 8);
  }
});

test("resaving a date replaces only its historical duplicates and keeps the selected row", options, async () => {
  assert.ok(pool);
  await pool.execute(`INSERT INTO ubl_date_entries (entry_date, month, year, breakfast) VALUES
    ('2026-10-21', 10, 2026, 1), ('2026-10-21', 10, 2026, 2), ('2026-10-22', 10, 2026, 3)`);
  const saved = await saveDailyEntry<{ id: number; breakfast: number }>(
    pool, { table: ublDateEntries, scope: [], syncUblBreakfast: true },
    { entryDate: "2026-10-21", month: 10, year: 2026, breakfast: 9 }, 1,
  );
  assert.equal(saved.id, 1);
  assert.equal(saved.breakfast, 9);
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT id, breakfast FROM ubl_date_entries ORDER BY id");
  assert.deepEqual(rows.map(row => [row.id, row.breakfast]), [[1, 9], [3, 3]]);
});

test("concurrent saves cannot create duplicate rows; location and meal type stay separate", options, async () => {
  assert.ok(pool);
  const config = { table: unichEmLunchEntries, scope: ["location", "mealType"] };
  const base = { entryDate: "2026-10-21", month: 10, year: 2026, location: "Plant A", mealType: "lunch" };
  await Promise.all(Array.from({ length: 8 }, (_, actual) =>
    saveDailyEntry(pool, config, { ...base, actual })));
  await saveDailyEntry(pool, config, { ...base, mealType: "dinner", actual: 12 });
  await saveDailyEntry(pool, config, { ...base, location: "Plant B", actual: 13 });
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT location, meal_type, COUNT(*) AS n FROM unichem_lunch_entries GROUP BY location, meal_type",
  );
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => Number(row.n) === 1));
});

test("concurrent saves for different dates do not overwrite each other", options, async () => {
  assert.ok(pool);
  const config = { table: unichEmLunchEntries, scope: ["location", "mealType"] };
  await Promise.all(Array.from({ length: 8 }, (_, index) =>
    saveDailyEntry(pool, config, {
      entryDate: `2026-11-${String(index + 1).padStart(2, "0")}`,
      month: 11, year: 2026, location: "Plant A", mealType: "lunch", actual: index + 10,
    })));
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT actual FROM unichem_lunch_entries WHERE entry_date BETWEEN '2026-11-01' AND '2026-11-08' ORDER BY entry_date",
  );
  assert.deepEqual(rows.map(row => row.actual), [10, 11, 12, 13, 14, 15, 16, 17]);
});

test("scope locks follow MySQL's case comparison", options, async () => {
  assert.ok(pool);
  const config = { table: unichEmLunchEntries, scope: ["location", "mealType"] };
  await Promise.all(["Factory", "factory"].map(location => saveDailyEntry(pool, config, {
    entryDate: "2026-12-05", month: 12, year: 2026, location, mealType: "lunch", actual: 3,
  })));
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM unichem_lunch_entries WHERE entry_date = '2026-12-05'",
  );
  assert.equal(Number(rows[0].n), 1);
});

test("moving an entry replaces only entries on its destination date", options, async () => {
  assert.ok(pool);
  await pool.execute(`INSERT INTO ubl_date_entries (entry_date, month, year, breakfast) VALUES
    ('2026-11-25', 11, 2026, 1), ('2026-11-26', 11, 2026, 2)`);
  const [before] = await pool.query<mysql.RowDataPacket[]>("SELECT id FROM ubl_date_entries WHERE entry_date = '2026-11-25'");
  await saveDailyEntry(pool, { table: ublDateEntries, scope: [] },
    { entryDate: "2026-11-26", month: 11, year: 2026, breakfast: 8 }, before[0].id);
  const [after] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT entry_date, breakfast FROM ubl_date_entries WHERE entry_date IN ('2026-11-25', '2026-11-26')",
  );
  assert.deepEqual(after.map(row => [row.entry_date, row.breakfast]), [["2026-11-26", 8]]);
});

test("failed replacement rolls back duplicate deletion", options, async () => {
  assert.ok(pool);
  await pool.execute(`INSERT INTO ubl_date_entries (entry_date, month, year, breakfast) VALUES
    ('2026-10-23', 10, 2026, 4), ('2026-10-23', 10, 2026, 5)`);
  await assert.rejects(saveDailyEntry(pool, { table: ublDateEntries, scope: [] },
    { entryDate: "2026-10-23", breakfast: { invalid: true } }));
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT breakfast FROM ubl_date_entries WHERE entry_date = '2026-10-23' ORDER BY id",
  );
  assert.deepEqual(rows.map(row => row.breakfast), [4, 5]);
});

test("Format 1 respects contractor breakfast totals when resaved", options, async () => {
  assert.ok(pool);
  await pool.execute("INSERT INTO ubl_f3_meal_entries (entry_date, contractor_id, meal_type, qty) VALUES (?, 1, 'breakfast', 17)", ["2026-10-21"]);
  const saved = await saveDailyEntry<{ contractorBreakfast: number }>(
    pool, { table: ublDateEntries, scope: [], syncUblBreakfast: true },
    { entryDate: "2026-10-21", month: 10, year: 2026, contractorBreakfast: 99 },
  );
  assert.equal(saved.contractorBreakfast, 17);
});

test("Format 1 and Format 3 concurrent saves share the date lock", options, async () => {
  assert.ok(pool);
  const date = "2026-12-01";
  await Promise.all([
    saveDailyEntry(pool, { table: ublDateEntries, scope: [], syncUblBreakfast: true },
      { entryDate: date, month: 12, year: 2026, breakfast: 12, contractorBreakfast: 0 }),
    saveUblContractorMeals(pool, [{ entryDate: date, contractorId: 1, mealType: "breakfast", qty: 6 }]),
  ]);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT breakfast, contractor_breakfast FROM ubl_date_entries WHERE entry_date = ?", [date],
  );
  assert.deepEqual(rows.map(row => [row.breakfast, row.contractor_breakfast]), [[12, 6]]);
});
