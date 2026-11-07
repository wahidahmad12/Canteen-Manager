import { z } from "zod";

export const MAX_PAYMENT_QR_BYTES = 1024 * 1024;
const qrError = "Payment QR must be a JPEG, PNG, or WebP image no larger than 1 MB.";

export function isValidPaymentQr(value: string): boolean {
  if (!value) return true;
  if (value.length > 4 * Math.ceil(MAX_PAYMENT_QR_BYTES / 3) + 32) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
  if (!match) return false;
  const encoded = match[2];
  const bytes = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (bytes > MAX_PAYMENT_QR_BYTES || bytes < 12) return false;
  const header = atob(encoded.slice(0, 16));
  if (match[1] === "jpeg") return header.startsWith("\xff\xd8\xff");
  if (match[1] === "png") return header.startsWith("\x89PNG\r\n\x1a\n");
  return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
}

export const vendorPaymentSchema = z.object({
  bankName: z.string().max(255),
  accountNo: z.string().max(100),
  ifscCode: z.string().max(20),
  branch: z.string().max(255),
  upiId: z.string().max(255),
  qrImage: z.string().refine(isValidPaymentQr, qrError),
});

export type VendorPayment = z.infer<typeof vendorPaymentSchema>;

export const emptyVendorPayment: VendorPayment = {
  bankName: "", accountNo: "", ifscCode: "", branch: "", upiId: "", qrImage: "",
};
