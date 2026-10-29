import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  const encodedKey = process.env.SMS_CREDENTIALS_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("SMS_CREDENTIALS_ENCRYPTION_KEY is not configured.");

  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) throw new Error("SMS_CREDENTIALS_ENCRYPTION_KEY must be a 32-byte base64url value.");
  return key;
}

export function encryptSmsApiKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSmsApiKey(value: string) {
  const [version, encodedIv, encodedAuthTag, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedAuthTag || !encodedCiphertext) {
    throw new Error("Stored SMS API key has an unsupported format.");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeBangladeshMobile(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `880${digits}`;
  return digits;
}
