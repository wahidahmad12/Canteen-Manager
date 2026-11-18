import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { WAMessage } from "@whiskeysockets/baileys";
import { isAllowedSlipMessage, isNewerMessage } from "./whatsapp-message-selection";

const sender = "919876543210@s.whatsapp.net";
const message = (remoteJid: string, remoteJidAlt?: string, fromMe = false, timestamp = 1): WAMessage => ({
  key: { remoteJid, remoteJidAlt, fromMe },
  messageTimestamp: timestamp,
});

test("accepts only direct messages from the configured sender, including LID addresses", () => {
  assert.equal(isAllowedSlipMessage(message(sender), sender), true);
  assert.equal(isAllowedSlipMessage(message("123@lid", sender), sender), true);
  assert.equal(isAllowedSlipMessage(message("123@lid"), sender), false);
  assert.equal(isAllowedSlipMessage(message("123@g.us", sender), sender), false);
  assert.equal(isAllowedSlipMessage(message(sender, undefined, true), sender), false);
});

test("selects the most recent message and rejects missing timestamps", () => {
  assert.equal(isNewerMessage(message(sender, undefined, false, 2), message(sender)), true);
  assert.equal(isNewerMessage(message(sender), message(sender, undefined, false, 2)), false);
  assert.equal(isNewerMessage(message(sender, undefined, false, 0), undefined), false);
});
