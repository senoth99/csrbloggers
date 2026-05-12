const PEPPER =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PEPPER
    ? process.env.NEXT_PUBLIC_AUTH_PEPPER
    : "casher-bloggers-auth";

/** SHA-256 hex (Web Crypto) */
export async function hashLoginPassword(login: string, password: string): Promise<string> {
  const normLogin = login.trim().replace(/^@+/, "").toLowerCase();
  const payload = `${PEPPER}|${normLogin}|${password}`;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto недоступен");
  }
  const buf = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
