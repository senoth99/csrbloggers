/** @type {import('next').NextConfig} */
const extraDevOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

/**
 * В dev Next.js может блокировать запросы к `/_next/*` с «чужого» host (→ 404 чанков).
 * Базово разрешаем localhost; для телефона / IP в LAN задайте NEXT_DEV_ALLOWED_ORIGINS.
 */
const allowedDevOrigins = [
  "127.0.0.1",
  "localhost",
  ...extraDevOrigins.filter((h) => h !== "127.0.0.1" && h !== "localhost"),
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins,
  async redirects() {
    return [
      { source: "/schedule", destination: "/dashboard", permanent: true },
      { source: "/cabinet", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
