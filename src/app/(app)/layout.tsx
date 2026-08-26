import { BottomNav, Sidebar } from "@/components/app-nav";
import { AppHeader } from "@/components/app-topbar";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/db";
import { getFamily } from "@/lib/queries";

/** shell ของโซนที่ล็อกอินแล้ว — header + sidebar (จอกว้าง) / bottom nav (มือถือ) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // ไม่มี session ปล่อยให้หน้าลูกจัดการ redirect เอง — layout แค่ไม่แสดง header
  const family = user?.activeFamilyId ? await getFamily(await getDb(), user.activeFamilyId) : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {user && (
          <AppHeader userName={user.name} userImage={user.image} familyName={family?.name} />
        )}
        <main className="flex-1 pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-[1120px] px-4 py-4 md:px-12 md:py-8">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
