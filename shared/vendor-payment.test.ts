import { strict as assert } from "node:assert";
import { test } from "node:test";
import { api } from "./routes";
import { emptyVendorPayment, isValidPaymentQr, MAX_PAYMENT_QR_BYTES, vendorPaymentSchema } from "./vendor-payment";

const image = (type: string, header: number[], length = 12) =>
  `data:image/${type};base64,${Buffer.concat([Buffer.from(header), Buffer.alloc(length - header.length)]).toString("base64")}`;

test("vendor updates remain compatible with older clients", () => {
  const parsed = api.vendors.update.input.parse({ name: "Vendor", phone: "123" });
  assert.equal(parsed.payment, undefined);
  assert.deepEqual(vendorPaymentSchema.parse(emptyVendorPayment), emptyVendorPayment);
  assert.equal(api.vendors.create.input.parse({ name: "Vendor" }).payment, undefined);
  assert.deepEqual(api.vendors.create.input.parse({ name: "Vendor", payment: emptyVendorPayment }).payment, emptyVendorPayment);
});

test("payment details retain account numbers as strings and validate field lengths", () => {
  const payment = { ...emptyVendorPayment, accountNo: "001234", ifscCode: "ABCD0123456", upiId: "vendor@bank" };
  assert.equal(api.vendors.update.input.parse({ name: "Vendor", payment }).payment?.accountNo, "001234");
  assert.equal(vendorPaymentSchema.safeParse({ ...payment, bankName: "x".repeat(256) }).success, false);
});

test("payment QR accepts only supported signatures and enforces the exact size limit", () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert.equal(isValidPaymentQr(""), true);
  assert.equal(isValidPaymentQr(image("png", png, MAX_PAYMENT_QR_BYTES)), true);
  assert.equal(isValidPaymentQr(image("png", png, MAX_PAYMENT_QR_BYTES + 1)), false);
  assert.equal(isValidPaymentQr(image("jpeg", [0xff, 0xd8, 0xff])), true);
  assert.equal(isValidPaymentQr(image("webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), true);
  assert.equal(isValidPaymentQr(image("jpeg", png)), false);
  assert.equal(isValidPaymentQr("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false);
  assert.equal(isValidPaymentQr("data:image/png;base64,not!base64"), false);
});
