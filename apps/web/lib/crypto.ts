import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Encriptação simétrica dos tokens OAuth antes de gravar em
// connected_accounts (access_token, refresh_token nunca ficam em texto
// simples na base de dados). AES-256-GCM: rápido, autenticado.
//
// APP_ENCRYPTION_KEY tem de ter pelo menos 32 caracteres — usada como
// entrada para derivar a chave real via scrypt, não usada diretamente.

const KEY = scryptSync(requireEnv("APP_ENCRYPTION_KEY"), "merlin-token-salt", 32);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente em falta: ${name}`);
  return v;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // formato: iv.authTag.ciphertext, tudo em base64
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
