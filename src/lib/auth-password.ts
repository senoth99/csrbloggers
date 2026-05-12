import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

const PEPPER =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PEPPER
    ? process.env.NEXT_PUBLIC_AUTH_PEPPER
    : "casher-bloggers-auth";

function sha256HexSync(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

/** SHA-256 hex: Web Crypto в secure context, иначе чистый JS (нужно для http + IP в Safari). */
export async function hashLoginPassword(login: string, password: string): Promise<string> {
  const normLogin = login.trim().replace(/^@+/, "").toLowerCase();
  const payload = `${PEPPER}|${normLogin}|${password}`;
  const buf = new TextEncoder().encode(payload);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256HexSync(buf);
}
