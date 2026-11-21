import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordRules, type PasswordRule } from "../shared/password-rules";

const bodySchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

const ruleMessages: Record<PasswordRule, string> = {
  length: "10 to 72 characters",
  bytes: "at most 72 UTF-8 bytes",
  uppercase: "an uppercase letter",
  lowercase: "a lowercase letter",
  digit: "a digit",
  symbol: "a symbol",
  username: "must not contain the username",
};

interface PasswordUserStore {
  getUserById(id: number): Promise<{ id: number; username: string; passwordHash: string } | undefined>;
  updateUser(id: number, data: { password: string }): Promise<unknown>;
}

export function changePasswordHandler(store: PasswordUserStore): RequestHandler {
  return async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Current password and new password must be strings", code: "invalidBody" });
    const user = await store.getUserById(req.session.userId);
    if (!user) return res.status(404).json({ message: "User not found", code: "userNotFound" });
    const { currentPassword, newPassword } = parsed.data;
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
      return res.status(400).json({ message: "Current password is incorrect", code: "incorrectCurrent" });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "New password must differ from the current password", code: "samePassword" });
    }
    const checks = passwordRules(newPassword, user.username);
    const missing = (Object.keys(checks) as PasswordRule[]).filter(rule => !checks[rule]);
    if (missing.length) {
      return res.status(400).json({ message: `New password requires: ${missing.map(rule => ruleMessages[rule]).join(", ")}`, code: "weakPassword", missing });
    }
    await store.updateUser(user.id, { password: newPassword });
    return res.json({ success: true });
  };
}
