import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { changePasswordHandler } from "./change-password";
import { passwordRules } from "../shared/password-rules";

test("changes only the authenticated user's password after verifying the old one", async () => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-only-secret", resave: false, saveUninitialized: false }));
  const users = [
    { id: 1, username: "admin", passwordHash: await bcrypt.hash("old", 4) },
    { id: 2, username: "other", passwordHash: await bcrypt.hash("other", 4) },
  ];
  let updates = 0;
  app.post("/test/login", (req, res) => {
    req.session.userId = req.body.id;
    res.json({ success: true });
  });
  app.post("/api/auth/change-password", (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    next();
  }, changePasswordHandler({
    getUserById: async id => users.find(user => user.id === id),
    updateUser: async (id, data) => {
      updates++;
      const user = users.find(candidate => candidate.id === id);
      if (!user) throw new Error("User not found");
      user.passwordHash = await bcrypt.hash(data.password, 4);
    },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, data: unknown, cookie?: string) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(data),
  });
  try {
    const body = { currentPassword: "old", newPassword: "StrongPass1!" };
    assert.equal((await post("/api/auth/change-password", body)).status, 401);
    const login = await post("/test/login", { id: 1 });
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const wrong = await post("/api/auth/change-password", { ...body, currentPassword: "wrong" }, cookie);
    assert.equal(wrong.status, 400);
    assert.equal((await wrong.json()).message, "Current password is incorrect");
    const same = await post("/api/auth/change-password", { currentPassword: "old", newPassword: "old" }, cookie);
    assert.equal(same.status, 400);
    const weak = await post("/api/auth/change-password", { currentPassword: "old", newPassword: "admin" }, cookie);
    const weakBody = await weak.json();
    assert.equal(weak.status, 400);
    assert.deepEqual(weakBody.missing, ["length", "uppercase", "digit", "symbol", "username"]);
    assert.equal((await post("/api/auth/change-password", { currentPassword: 3, newPassword: "StrongPass1!" }, cookie)).status, 400);
    assert.equal(updates, 0);
    const success = await post("/api/auth/change-password", { ...body, id: 2 }, cookie);
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { success: true });
    assert.equal(updates, 1);
    assert.ok(await bcrypt.compare("StrongPass1!", users[0].passwordHash));
    assert.equal(await bcrypt.compare("old", users[0].passwordHash), false);
    assert.ok(await bcrypt.compare("other", users[1].passwordHash));
    assert.equal((await post("/api/auth/change-password", body, cookie)).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("enforces case-insensitive username, character and bcrypt byte limits", () => {
  assert.ok(Object.values(passwordRules("StrongPass1!", "admin")).every(Boolean));
  assert.equal(passwordRules("StrongADMIN1!", "admin").username, false);
  assert.equal(passwordRules(`${"a".repeat(68)}A1!`, "admin").length, true);
  assert.equal(passwordRules(`${"a".repeat(70)}A1!`, "admin").length, false);
  const unicode = passwordRules(`${"é".repeat(34)}Aa1!`, "admin");
  assert.equal(unicode.length, true);
  assert.equal(unicode.bytes, true);
  assert.equal(passwordRules(`${"é".repeat(35)}Aa1!`, "admin").bytes, false);
  assert.equal(passwordRules("Abcdef123é", "admin").symbol, false);
  assert.equal(passwordRules("Abcdef123₹", "admin").symbol, true);
});
