import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CLIENT_COUPON_TYPES, couponMonthlySummary, couponTypeForLabel, summarizeCouponForm } from "./client-coupons";

test("recognizes coupon columns from the existing form", () => {
  assert.equal(couponTypeForLabel("Coupon Amount ₹65"), "65");
  assert.equal(couponTypeForLabel("Coupon Amount ₹ 25"), "25");
  assert.equal(couponTypeForLabel("coupon amount ₹ 2"), "2");
  assert.equal(couponTypeForLabel("Tea"), "tea");
  assert.equal(couponTypeForLabel("Coupon Amount ₹ 125"), undefined);
});

test("summarizes saved quantities per date and denomination, including historical fields", () => {
  const fields = CLIENT_COUPON_TYPES.map((type, index) => ({
    id: index + 1,
    label: type.value === "tea" ? "Tea" : `Coupon Amount ₹ ${type.value}`,
  }));
  fields.push({ id: 20, label: "Coupon Amount ₹65" });
  const result = summarizeCouponForm({
    fields,
    entries: [
      { fieldId: 1, entryDate: "2026-10-01", qty: 92 },
      { fieldId: 20, entryDate: "2026-10-01", qty: 3 },
      { fieldId: 1, entryDate: "2026-10-02", qty: 66 },
      { fieldId: 8, entryDate: "2026-10-01", qty: 102 },
    ],
  });
  assert.deepEqual(result.counts, { "2026-10-01|65": 95, "2026-10-02|65": 66, "2026-10-01|tea": 102 });
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unrecognized, []);
});

test("identifies missing denominations and unrecognized saved data", () => {
  const result = summarizeCouponForm({
    fields: [{ id: 1, label: "Coupon Amount ₹65" }, { id: 2, label: "Other" }],
    entries: [{ fieldId: 2, entryDate: "2026-10-01", qty: 4 }],
  });
  assert.deepEqual(result.missing, ["25", "20", "17", "10", "5", "2", "Tea"]);
  assert.deepEqual(result.unrecognized, ["Other"]);
});

test("combines employee and contractor coupon totals with tea at 12 rupees", () => {
  const date = "2026-10-01";
  const employeeQty = [2470, 1383, 923, 972, 2752, 1104, 444, 3651];
  const contractorQty = [68, 80, 24, 27, 70, 39, 18, 3126];
  const employee = Object.fromEntries(CLIENT_COUPON_TYPES.map((type, index) => [`${date}|${type.value}`, employeeQty[index]]));
  const contractor = Object.fromEntries(CLIENT_COUPON_TYPES.map((type, index) => [`${date}|${type.value}`, contractorQty[index]]));
  const summary = couponMonthlySummary(employee, contractor, [date]);
  assert.equal(summary[0].totalCoupon, 2538);
  assert.equal(summary[0].totalAmount, 164970);
  assert.equal(summary[7].totalCoupon, 6777);
  assert.equal(summary[7].totalAmount, 81324);
  assert.equal(summary.reduce((total, row) => total + row.totalAmount, 0), 353651);
});
