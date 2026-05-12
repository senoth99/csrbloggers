/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/screens/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /** Только три базовых цвета: фон, передний план, акцент */
        app: {
          bg: "#000000",
          fg: "#ffffff",
          accent: "#0d5c32",
        },
      },
      accentColor: {
        app: "#0d5c32",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "accent-glow": "0 0 24px rgba(13, 92, 50, 0.35)",
      },
    },
  },
  plugins: [],
};
