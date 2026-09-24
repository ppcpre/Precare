"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useAction } from "next-safe-action/hooks";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/actions/push";

/**
 * เปิด/ปิดการแจ้งเตือนที่ทำงานแม้ปิดแอป
 *
 * ต่างจาก Notification API เดิมที่ทำงานเฉพาะตอนเปิดแท็บค้างไว้
 * ตัวนี้ผูกกับ service worker + push subscription จึงเตือนได้แม้ปิดแอปไปแล้ว
 *
 * ⚠️ บน iOS ต้อง **ติดตั้งลงจอโฮมก่อน** ถึงจะขออนุญาตได้
 *    Safari ในเบราว์เซอร์ปกติไม่มี PushManager ให้เลย — ต้องบอกผู้ใช้ให้ตรง
 *    ไม่ใช่ปล่อยให้กดแล้วไม่มีอะไรเกิดขึ้น
 */
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const permissionNow = () =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

const b64urlToUint8 = (s: string) => {
  const b64 = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const permission = useSyncExternalStore(subscribe, permissionNow, () => "unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = useAction(savePushSubscription);
  const remove = useAction(removePushSubscription);
  const test = useAction(sendTestPush, {
    onSuccess: () => setDone("ส่งแล้ว — ถ้าไม่เห็นการแจ้งเตือนใน 10 วินาที แปลว่ายังไม่ทำงาน"),
    onError: ({ error: e }) => setError(e.serverError ?? "ส่งทดสอบไม่สำเร็จ"),
  });

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined";

  const enable = useCallback(async () => {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      ping();
      if (perm !== "granted") {
        setError("ยังไม่ได้อนุญาต — เปิดสิทธิ์แจ้งเตือนให้เว็บนี้ในตั้งค่าเบราว์เซอร์ได้");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToUint8(vapidPublicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await save.executeAsync({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? null,
        auth: json.keys?.auth ?? null,
      });
      if (res?.serverError) setError(res.serverError);
      else setDone("เปิดแล้ว — ลองกดส่งทดสอบดูได้");
    } catch {
      setError("เปิดการแจ้งเตือนไม่สำเร็จบนเครื่องนี้");
    } finally {
      setBusy(false);
      ping();
    }
  }, [save, vapidPublicKey]);

  const disable = useCallback(async () => {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove.executeAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setDone("ปิดการแจ้งเตือนบนเครื่องนี้แล้ว");
    } catch {
      setError("ปิดการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setBusy(false);
      ping();
    }
  }, [remove]);

  if (!supported) {
    return (
      <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
        เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนแบบปิดแอปแล้วยังเตือนได้
        <br />
        บน iPhone ต้องเพิ่มแอปลงหน้าจอโฮมก่อน แล้วเปิดจากไอคอนนั้น
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {permission === "granted" ? (
          <>
            <Button variant="secondary" loading={busy} onClick={disable}>
              <BellOff size={18} strokeWidth={1.9} />
              ปิดการแจ้งเตือน
            </Button>
            <Button variant="secondary" loading={test.isPending} onClick={() => test.execute({})}>
              <Send size={18} strokeWidth={1.9} />
              ส่งทดสอบ
            </Button>
          </>
        ) : (
          <Button loading={busy} onClick={enable}>
            <Bell size={18} strokeWidth={1.9} />
            เปิดการแจ้งเตือน
          </Button>
        )}
      </div>

      {done && <p className="text-xs leading-relaxed text-ink-600">{done}</p>}
      {error && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3 py-2.5 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
