/**
 * ไอคอนแคปซูล — ครึ่งหนึ่งถมสีจางไว้
 *
 * ไอคอน Pill ของ lucide เป็นเส้นขอบล้วนทั้งเม็ด มีแค่เส้นคาดกลาง
 * ย่อลงมาขนาดเล็กแล้วดูเหมือนกล่องมนๆ มากกว่าเม็ดยา
 * ถมครึ่งหนึ่งด้วยสีเดียวกันแบบจาง ทำให้อ่านออกทันทีว่าเป็นแคปซูลสองฝา
 *
 * ใช้ currentColor ทั้งคู่ ไอคอนจึงเปลี่ยนสีตามข้อความรอบๆ ได้เหมือนไอคอนอื่น
 * และส่วนที่ถมจะจางลงตามอัตโนมัติ ไม่ต้องกำหนดสีเทาตายตัวที่จะเพี้ยนบนพื้นเข้ม
 */
export function Capsule({
  size = 20,
  strokeWidth = 1.9,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* เอียง 45 องศาเหมือนไอคอนยาทั่วไป — วางนอนแล้วดูเหมือนยาเม็ดรี */}
      <g transform="rotate(-45 12 12)">
        <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
        {/* ครึ่งขวารวมฝาโค้ง — ไม่มีเส้นขอบของตัวเอง ไม่งั้นจะหนาซ้อนกับ rect */}
        <path
          d="M12 8.5 H17 A3.5 3.5 0 0 1 17 15.5 H12 Z"
          fill="currentColor"
          fillOpacity="0.35"
          stroke="none"
        />
        <line x1="12" y1="8.5" x2="12" y2="15.5" />
      </g>
    </svg>
  );
}
