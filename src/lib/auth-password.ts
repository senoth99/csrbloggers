import { createHash, scrypt, randomBytes, timingSafeEqual } from "crypto";

const LEGACY_PEPPER = process.env.AUTH_PEPPER?.trim() || "casher-bloggers-auth";
const KEYLEN = 32;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function scryptHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Hash new password with scrypt+random salt. Format: "scrypt:<salt_hex>:<hash_hex>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptHash(password, salt);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

/**
 * Verify password against stored hash.
 * Supports scrypt (new) and SHA-256+pepper (legacy — auto-migrated on login).
 * login required only for legacy path.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  login: string,
): Promise<boolean> {
  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    const derived = await scryptHash(password, salt!);
    const stored = Buffer.from(hashHex!, "hex");
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  }
  const legacy = hashLegacy(login, password);
  try {
    return timingSafeEqual(Buffer.from(legacy, "utf8"), Buffer.from(storedHash, "utf8"));
  } catch {
    return false;
  }
}

function hashLegacy(login: string, password: string): string {
  const normLogin = login.trim().replace(/^@+/, "").toLowerCase();
  return createHash("sha256")
    .update(`${LEGACY_PEPPER}|${normLogin}|${password}`)
    .digest("hex");
}

/**
 * @deprecated Use hashPassword. Kept for seed migration only.
 */
export async function hashLoginPassword(login: string, password: string): Promise<string> {
  return hashLegacy(login, password);
}
