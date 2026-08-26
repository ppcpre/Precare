/**
 * โลโก้ Pre Care — ตัวเลือก C "หน่ออ่อน" ใบเขียว sage
 * สี: หัวใจ peach-500 #E89A6C · จุด peach-300 #F5BE9B · ใบ sage #8AA383
 */
export function Logo({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      role="img"
      aria-label="Pre Care"
    >
      <path
        d="M48 82C48 82 17 63 17 42.5A16.5 16.5 0 0 1 48 34a16.5 16.5 0 0 1 31 8.5C79 63 48 82 48 82Z"
        fill="#E89A6C"
      />
      <path d="M48 36c0-2 .3-4 .9-5.8" stroke="#8AA383" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M50 28c1.5-6 7-10 13-10 0 6.5-5 12-11.5 12.5-.6 0-1.1-1-1.5-2.5Z"
        fill="#8AA383"
      />
      <circle cx="38" cy="50" r="4.5" fill="#F5BE9B" />
      <circle cx="58" cy="50" r="4.5" fill="#F5BE9B" />
    </svg>
  );
}

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.35Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.83V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59C7.2 7.72 9.4 5.95 12 5.95Z" />
    </svg>
  );
}
