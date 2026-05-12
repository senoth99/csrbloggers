import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Casher — панель блоггеров",
  description: "Внутренняя панель ведения блоггеров Casher",
  icons: { icon: "/casher-logo.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={inter.variable}
      style={{ backgroundColor: "#000000", minHeight: "100%", colorScheme: "dark" }}
    >
      <body
        className="font-sans"
        style={{
          margin: 0,
          minHeight: "100%",
          backgroundColor: "#000000",
          color: "#ffffff",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
