"use client";

import { useState } from "react";
import { User } from "lucide-react";

/**
 * avatar วงกลม — ถ้ายังไม่มีรูปใช้ตัวอักษรแรกของชื่อ
 *
 * เป็น client component เพราะต้องมี onError
 * รูปจาก Google (lh3.googleusercontent.com) หลุดได้หลายทาง: URL หมดอายุ,
 * ผู้ใช้ลบรูปฝั่ง Google, เน็ตมีปัญหา หรือ CSP บล็อก (เคยเกิดมาแล้วตอน T6.5)
 * ถ้าไม่ดักจะเห็นไอคอนรูปพังของเบราว์เซอร์คาอยู่บน header ทุกหน้า
 * ตกกลับไปเป็นตัวอักษรแรกของชื่อดีกว่า อย่างน้อยยังบอกได้ว่าใคร
 */
export function Avatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2/Google, next/image ตั้ง unoptimized อยู่แล้วจึงไม่ได้ประโยชน์
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-brown-300 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0) || <User size={size * 0.5} />}
    </span>
  );
}
