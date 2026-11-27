import type { LucideIcon } from "lucide-react";

/** Illustration + หัวข้อ + คำอธิบาย + action — action ซ่อนได้เมื่อ viewer */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-8 py-12 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-cream-100">
        <Icon size={44} strokeWidth={1.6} className="text-brown-300" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
        <p className="max-w-xs text-sm leading-relaxed text-ink-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
