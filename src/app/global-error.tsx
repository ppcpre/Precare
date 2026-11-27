"use client";

/** ด่านสุดท้าย — error ที่หลุดออกมาจนถึง root layout ต้องมี html/body ของตัวเอง */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: "#FDFBF7",
          color: "#2B2420",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>เกิดข้อผิดพลาด</h1>
        <p style={{ fontSize: 14, color: "#6B6259", margin: 0, lineHeight: 1.6 }}>
          ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง
        </p>
        <button
          onClick={reset}
          style={{
            height: 44,
            padding: "0 20px",
            borderRadius: 12,
            border: "none",
            background: "#6B4F3F",
            color: "#fff",
            fontSize: 16,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          ลองใหม่
        </button>
      </body>
    </html>
  );
}
