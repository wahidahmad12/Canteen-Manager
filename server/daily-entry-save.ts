import { getTableColumns, getTableName } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type DailyTable = {
  table: MySqlTable;
  scope: readonly string[];
  syncUblBreakfast?: boolean;
  immutableDate?: boolean;
};

function dateKey(value: unknown): string {
  const date = typeof value === "string" ? value.slice(0, 10) : "";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("A valid entry date is required");
  }
  return date;
}

export async function lockDailyEntry(connection: PoolConnection, form: string, date: string, scope: readonly string[]) {
  const [scope1 = "", scope2 = ""] = scope;
  await connection.execute(
    `INSERT INTO daily_entry_locks (form_name, entry_date, scope1, scope2) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE form_name = VALUES(form_name)`,
    [form, date, scope1, scope2],
  );
  await connection.execute(
    `SELECT form_name FROM daily_entry_locks WHERE form_name = ? AND entry_date = ? AND scope1 = ? AND scope2 = ? FOR UPDATE`,
    [form, date, scope1, scope2],
  );
}

/**
 * Serializes saves by form, date and scope without deleting historical duplicates
 * until that particular date is saved.
 */
export async function saveDailyEntry<T>(
  pool: Pool,
  config: DailyTable,
  input: Record<string, unknown>,
  id?: number,
): Promise<T> {
  const columns = getTableColumns(config.table);
  const table = getTableName(config.table);
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    let original: RowDataPacket | undefined;
    if (id !== undefined) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid entry ID");
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
      original = rows[0];
      if (!original) throw new Error("Entry not found");
    }

    const originalDate = original ? dateKey(original.entry_date) : undefined;
    const targetDate = dateKey(input.entryDate ?? originalDate);
    if (config.immutableDate && originalDate && targetDate !== originalDate) {
      throw new Error("The entry date cannot be changed");
    }
    const scopeValues = config.scope.map(key => {
      const value = original ? original[columns[key].name] : input[key];
      if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
      return value;
    });
    for (const date of Array.from(new Set([targetDate, ...(originalDate ? [originalDate] : [])])).sort()) {
      await lockDailyEntry(connection, table, date, scopeValues);
    }

    if (original) {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id = ? FOR UPDATE`, [original.id]);
      if (!rows[0] || dateKey(rows[0].entry_date) !== originalDate ||
          config.scope.some((key, index) => rows[0][columns[key].name] !== scopeValues[index])) {
        throw new Error("Entry changed while saving; reload and try again");
      }
    }

    const where = ["entry_date = ?", ...config.scope.map(key => `\`${columns[key].name}\` = ?`)].join(" AND ");
    const params = [targetDate, ...scopeValues];
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM \`${table}\` WHERE ${where} ORDER BY updated_at DESC, id DESC FOR UPDATE`, params,
    );
    const keepId = id ?? (existing[0] ? Number(existing[0].id) : undefined);
    if (keepId) {
      await connection.execute(`DELETE FROM \`${table}\` WHERE ${where} AND id <> ?`, [...params, keepId]);
    }

    const values: Record<string, string | number | boolean | null> = {};
    for (const [key, column] of Object.entries(columns)) {
      if (key === "id" || key === "createdAt" || key === "updatedAt" || config.scope.includes(key)) continue;
      const value = input[key];
      if (value !== undefined) {
        if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
          throw new Error(`Invalid value for ${key}`);
        }
        if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Invalid value for ${key}`);
        values[column.name] = key === "entryDate" ? targetDate : value;
      }
    }
    values.entry_date = targetDate;
    config.scope.forEach((key, index) => { values[columns[key].name] = scopeValues[index]; });

    if (config.syncUblBreakfast) {
      const [totals] = await connection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS c, COALESCE(SUM(qty), 0) AS total FROM ubl_f3_meal_entries WHERE entry_date = ? AND meal_type = 'breakfast' FOR UPDATE`,
        [targetDate],
      );
      if (Number(totals[0].c) > 0) values.contractor_breakfast = Number(totals[0].total);
    }

    const names = Object.keys(values);
    let savedId = keepId;
    if (savedId) {
      await connection.execute(
        `UPDATE \`${table}\` SET ${names.map(name => `\`${name}\` = ?`).join(", ")}, updated_at = NOW() WHERE id = ?`,
        [...names.map(name => values[name]), savedId],
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`${table}\` (${names.map(name => `\`${name}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
        names.map(name => values[name]),
      );
      savedId = result.insertId;
    }
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` WHERE id = ?`, [savedId]);
    if (!rows[0]) throw new Error("Saved entry could not be read");
    const result: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(columns)) result[key] = rows[0][column.name];
    await connection.commit();
    return result as T;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveUblContractorMeals(pool: Pool, entries: Record<string, unknown>[]): Promise<void> {
  const mealTypes = ["breakfast", "lunch", "evening_snacks", "dinner"];
  const valid = entries.flatMap(entry => {
    const date = String(entry?.entryDate ?? "").split("T")[0];
    const contractorId = Number(entry?.contractorId);
    const mealType = String(entry?.mealType ?? "");
    const qty = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !contractorId || !mealTypes.includes(mealType)) return [];
    return [{ date, contractorId, mealType, qty }];
  });
  const breakfastDates = Array.from(new Set(valid.filter(entry => entry.mealType === "breakfast").map(entry => entry.date))).sort();
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    for (const date of breakfastDates) await lockDailyEntry(connection, "ubl_date_entries", date, []);
    for (const entry of valid) {
      if (entry.qty > 0) {
        await connection.execute(
          `INSERT INTO ubl_f3_meal_entries (entry_date, contractor_id, meal_type, qty) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE qty = VALUES(qty)`,
          [entry.date, entry.contractorId, entry.mealType, entry.qty],
        );
      } else {
        await connection.execute(
          `DELETE FROM ubl_f3_meal_entries WHERE entry_date = ? AND contractor_id = ? AND meal_type = ?`,
          [entry.date, entry.contractorId, entry.mealType],
        );
      }
    }
    for (const date of breakfastDates) {
      const [totals] = await connection.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(qty), 0) AS total FROM ubl_f3_meal_entries WHERE entry_date = ? AND meal_type = 'breakfast'`,
        [date],
      );
      const total = Number(totals[0].total);
      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM ubl_date_entries WHERE entry_date = ? LIMIT 1", [date],
      );
      if (existing.length) {
        await connection.execute(
          "UPDATE ubl_date_entries SET contractor_breakfast = ?, updated_at = NOW() WHERE entry_date = ?",
          [total, date],
        );
      } else if (total > 0) {
        const day = new Date(`${date}T00:00:00`);
        await connection.execute(
          `INSERT INTO ubl_date_entries (entry_date, month, year, week_day, contractor_breakfast) VALUES (?, ?, ?, ?, ?)`,
          [date, day.getMonth() + 1, day.getFullYear(), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()], total],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
