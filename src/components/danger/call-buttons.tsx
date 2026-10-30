import { Phone } from "lucide-react";
import { EMS } from "@/data/danger-signs";

/**
 * ปุ่มโทร — ใช้ `tel:` ธรรมดา ให้ระบบโทรศัพท์จัดการต่อ
 *
 * ไม่เขียนระบบเรียกรถพยาบาลเอง สพฉ. มีแอป ThaiEMS 1669 ที่ส่งพิกัดให้ศูนย์สั่งการ
 * ได้อยู่แล้ว ทำแข่งจะได้ของที่แย่กว่าและต้องดูแลตลอดไป — แค่ชี้ไปที่แอปนั้นพอ
 */
export function EmsButton({ big = false }: { big?: boolean }) {
  return (
    <a
      href={`tel:${EMS.phone}`}
      className={
        big
          ? "flex h-20 items-center gap-3.5 rounded-xl bg-danger-strong px-[18px] text-white"
          : "flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-[10px] bg-danger-strong text-[19px] font-bold text-white"
      }
    >
      <Phone size={big ? 28 : 20} strokeWidth={2} className="shrink-0" aria-hidden />
      {big ? (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[22px] font-bold">{EMS.label}</span>
          <span className="text-base text-peach-100">{EMS.note}</span>
        </span>
      ) : (
        EMS.label
      )}
    </a>
  );
}

/**
 * ปุ่มโทรโรงพยาบาลที่ฝากครรภ์
 *
 * ถ้ายังไม่ได้กรอกเบอร์ **ไม่ซ่อนปุ่มทิ้ง** แต่เปลี่ยนเป็นชวนให้ไปกรอก —
 * ช่องว่างตรงนี้คือสิ่งที่ควรเติมก่อนจะต้องใช้จริง ถ้าซ่อนไปเลยจะไม่มีใครรู้ว่าทำได้
 */
export function HospitalButton({
  name,
  phone,
  canEdit,
}: {
  name: string | null;
  phone: string | null;
  canEdit: boolean;
}) {
  if (phone) {
    return (
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="flex h-20 items-center gap-3.5 rounded-xl bg-brown-700 px-[18px] text-white"
      >
        <Phone size={26} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-xl font-bold">โทร รพ. ที่ฝากครรภ์</span>
          <span className="truncate text-base text-brown-100">
            {name ? `${name} · ${phone}` : phone}
          </span>
        </span>
      </a>
    );
  }

  if (!canEdit) return null;

  return (
    <a
      href="/profile/pregnancy"
      className="flex h-20 items-center gap-3.5 rounded-xl border-2 border-dashed border-brown-300 bg-white px-[18px] text-brown-700"
    >
      <Phone size={26} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[19px] font-bold">ใส่เบอร์ รพ. ที่ฝากครรภ์</span>
        <span className="text-[15px] leading-snug text-ink-600">
          ใส่ไว้ก่อน จะได้ไม่ต้องหาตอนฉุกเฉิน
        </span>
      </span>
    </a>
  );
}
