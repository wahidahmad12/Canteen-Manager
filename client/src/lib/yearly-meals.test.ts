import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadMealTables } from "./yearly-meals";

test("HUL requests only selected location and totals selected years", async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    return new Response(JSON.stringify([{ month: 1, breakfast: url.includes("2025") ? 1 : 2, guestLunch: 1 }]), { status: 200 });
  });
  const [table] = await loadMealTables("Hindustan Unilever Limited", 1, [{ year: 2025, month: 1 }, { year: 2026, month: 1 }], "KPF");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes("location=KPF")));
  assert.equal(table.total[11], 245);
});

test("Unichem location summary uses Sunday lunch only from the selected location", async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    const rows = url.includes("snack-entries")
      ? [{ breakfast: 2, eveningSnacks: 1, nightSnacks: 0 }]
      : [{ entryDate: "2026-01-04", mealType: "lunch", billQty: 3 }, { entryDate: "2026-01-05", mealType: "dinner", billQty: 1 }];
    return new Response(JSON.stringify(rows), { status: 200 });
  });
  const [table] = await loadMealTables("Unichem Laboratories Ltd", 2, [{ year: 2026, month: 1 }], "Unit-2");
  assert.ok(calls.every(url => url.includes("location=Unit-2")));
  assert.deepEqual(table.rows[0].slice(1), [2, 1, 0, 3, 3, 1, 307]);
});

test("Cipla includes meal and invoice amounts for the selected billing periods", async t => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    const rows = url.includes("contractor-invoices") ? [{ month: 12, invoiceTotal: 50 }] : [{ month: 12, breakfast: 1, lunch: 2, dinner: 1 }];
    return new Response(JSON.stringify(rows), { status: 200 });
  });
  const [table] = await loadMealTables("Cipla Limited", 3, [{ year: 2025, month: 12 }], "all");
  assert.match(String(table.rows[0][0]), /20 Jan 2026/);
  assert.deepEqual(table.rows[0].slice(1), [1, 2, 1, 197, 50, 247]);
});

test("report fails instead of producing partial data on an API error", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("denied", { status: 403 }));
  await assert.rejects(loadMealTables("Hindustan Unilever Limited", 1, [{ year: 2026, month: 1 }], "KPF"), /403/);
});

test("unmapped branded client locations do not receive another location's data", async () => {
  await assert.rejects(loadMealTables("Cipla Limited - Other Location", 1, [{ year: 2026, month: 1 }], "all"), /cannot be safely matched/);
});

test("UBL reports quantities and amounts for both meal and lunch summaries", async t => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const data = String(input).includes("ubl-lunch") ? [{ month: 1, perment: 5, casual: 2 }] : [{ month: 1, tea: 2, biscuit: 4, lunch: 1 }];
    return new Response(JSON.stringify(data), { status: 200 });
  });
  const [meals, lunch] = await loadMealTables("United Breweries Limited", 5, [{ year: 2026, month: 1 }], "all");
  assert.equal(meals.rows[0][1], 2);
  assert.equal(meals.rows[0][2], 14);
  assert.equal(meals.rows[0][meals.headers.length - 1], 66);
  assert.equal(lunch.rows[0][5], 7);
});

test("custom client reports are scoped by client ID and include forms without entries", async t => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.match(String(input), /clientId=42/);
    return new Response(JSON.stringify([{ formId: 1, formName: "Lunch", month: 1, amount: 125 }, { formId: 2, formName: "Tea", month: null, amount: 0 }]), { status: 200 });
  });
  const [table] = await loadMealTables("Custom Client", 42, [{ year: 2026, month: 1 }], "all");
  assert.deepEqual(table.rows[0], ["January 2026", 125, 0, 125]);
});

test("PEC applies saved monthly rates and includes additional items", async t => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    const rate = { redLabel: 10, tataTea: 0, coffee: 0, sugar: 0, ginger: 0, biscuit: 0, teaCup: 0, greenElaychi: 0, greenTea: 0, blackSalt: 0, milk: 5, month: 1 };
    const data = url.includes("pec-ventures-rates") ? { monthly: [rate], default: null }
      : url.includes("pec-custom-items") ? [{ itemId: 4, name: "Extra", month: 1, qty: 2, amount: 30 }]
      : url.includes("lunch-yearly") ? [{ month: 1, lunchBill: 2 }]
      : [{ month: 1, redLabel: 2, milkMorning: 1, milkEvening: 1 }];
    return new Response(JSON.stringify(data), { status: 200 });
  });
  const [table] = await loadMealTables("PEC Ventures Private Limited", 3, [{ year: 2026, month: 1 }], "all");
  assert.equal(table.rows[0][2], 140);
  assert.equal(table.rows[0][table.headers.length - 1], 60);
});
