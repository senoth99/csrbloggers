"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000000",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Критическая ошибка</h1>
        <p
          style={{
            color: "rgba(255, 255, 255, 0.55)",
            marginTop: "0.5rem",
            textAlign: "center",
            maxWidth: "28rem",
          }}
        >
          {error.message || "Не удалось загрузить приложение."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1.25rem",
            padding: "0.6rem 1.5rem",
            background: "#0d5c32",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
