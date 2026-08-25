import { BottomNav, Sidebar } from "@/components/app-nav";

/** shell ของโซนที่ล็อกอินแล้ว — sidebar บนจอกว้าง, bottom nav บนมือถือ */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-4 md:px-12 md:py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
