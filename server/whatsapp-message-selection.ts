import type { WAMessage } from "@whiskeysockets/baileys";

export function isAllowedSlipMessage(message: WAMessage, allowed: string): boolean {
  const { remoteJid, remoteJidAlt, fromMe } = message.key;
  if (!remoteJid || fromMe || (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid"))) return false;
  return remoteJid === allowed || remoteJidAlt === allowed;
}

export function isNewerMessage(candidate: WAMessage, current: WAMessage | undefined): boolean {
  const timestamp = Number(candidate.messageTimestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  if (!current) return true;
  return timestamp > Number(current.messageTimestamp);
}
