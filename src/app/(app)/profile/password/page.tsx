import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PasswordForm } from "@/components/profile/password-form";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/db";
import { hasPassword } from "@/lib/queries";

export const metadata = { title: "เปลี่ยนรหัสผ่าน · Pre Care" };

/**
 * หน้านี้ผูกกับ "ผู้ใช้" ไม่ใช่ "ครอบครัว" จึงใช้ session อย่างเดียว
 * (เหมือน profile/edit และ profile/privacy — ดู scripts/check-authz.mjs)
 */
export default async function PasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  /**
   * คนที่เข้าด้วย Google ไม่มีรหัสผ่านให้เปลี่ยน — เด้งกลับ ไม่ใช่โชว์ฟอร์ม
   * ที่กรอกยังไงก็ไม่ผ่าน (เมนูในหน้าโปรไฟล์ก็ไม่แสดงให้เห็นอยู่แล้ว
   * แต่ URL พิมพ์ตรงได้ จึงต้องกันที่นี่ด้วย)
   */
  const db = await getDb();
  if (!(await hasPassword(db, user.id))) redirect("/profile");

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-1">
        <Link
          href="/profile"
          aria-label="กลับไปหน้าโปรไฟล์"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={21} strokeWidth={1.9} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">เปลี่ยนรหัสผ่าน</h1>
      </header>

      <Card className="flex flex-col gap-3">
        <PasswordForm email={user.email} />
      </Card>
    </div>
  );
}
