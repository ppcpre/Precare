"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Check, Plus, Trash2 } from "lucide-react";
import { addQuestion, deleteQuestion, toggleAsked } from "@/actions/visit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Item = { id: string; text: string; askedAt: string | null };

/**
 * รายการคำถาม
 *
 * ติ๊กว่าถามแล้วไม่ได้ลบทิ้ง — ย้ายลงไปอยู่กลุ่มล่างแทน
 * เพราะคำถามที่ถามไปแล้วมักถูกถามซ้ำในนัดถัดไปเนื่องจากจำคำตอบไม่ได้
 * การเห็นว่า "เคยถามไปแล้ว" จึงมีค่าพอๆ กับรายการที่ยังไม่ได้ถาม
 */
export function QuestionList({ items, canWrite }: { items: Item[]; canWrite: boolean }) {
  const [text, setText] = useState("");
  const add = useAction(addQuestion, { onSuccess: () => setText("") });
  const toggle = useAction(toggleAsked);
  const remove = useAction(deleteQuestion);

  const open = items.filter((q) => !q.askedAt);
  const asked = items.filter((q) => q.askedAt);
  const serverError =
    add.result.serverError ?? toggle.result.serverError ?? remove.result.serverError;

  return (
    <div className="flex flex-col gap-4">
      <Section title={`ยังไม่ได้ถาม · ${open.length} ข้อ`} empty="ยังไม่มีคำถามที่จดไว้">
        {open.map((q) => (
          <Row key={q.id} q={q} canWrite={canWrite} onToggle={toggle.execute} onDelete={remove.execute} />
        ))}
      </Section>

      {asked.length > 0 && (
        <Section title={`ถามแล้ว · ${asked.length} ข้อ`}>
          {asked.map((q) => (
            <Row key={q.id} q={q} canWrite={canWrite} onToggle={toggle.execute} onDelete={remove.execute} />
          ))}
        </Section>
      )}

      {canWrite && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (t) add.execute({ text: t });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="เช่น บวมที่เท้าตอนเย็นเป็นเรื่องปกติไหม"
            aria-label="คำถามใหม่"
            className="min-h-11 flex-1 rounded-md border border-cream-200 bg-white px-3.5 text-[15px] text-ink-900 placeholder:text-ink-400"
          />
          <Button type="submit" loading={add.isPending} disabled={!text.trim()}>
            <Plus size={18} strokeWidth={2} />
            เพิ่ม
          </Button>
        </form>
      )}

      {serverError && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {serverError}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode;
}) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm text-ink-600">{title}</h2>
      {has ? children : empty && <p className="text-[13px] text-ink-400">{empty}</p>}
    </section>
  );
}

function Row({
  q,
  canWrite,
  onToggle,
  onDelete,
}: {
  q: Item;
  canWrite: boolean;
  onToggle: (i: { id: string; asked: boolean }) => void;
  onDelete: (i: { id: string }) => void;
}) {
  const done = Boolean(q.askedAt);
  return (
    <div className="flex items-center gap-5 rounded-md border border-cream-200 bg-white p-3 shadow-[var(--shadow-card)]">
      {/* พื้นที่แตะ 44px ตามเกณฑ์ของ design system แต่กล่องที่เห็นยังเล็กเท่าเดิม
          ติ๊กผิดข้อในห้องตรวจแล้วต้องมานั่งแก้ คือสิ่งที่หน้านี้มีไว้เพื่อเลี่ยง */}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `ยกเลิกว่าถามแล้ว: ${q.text}` : `ถามแล้ว: ${q.text}`}
        disabled={!canWrite}
        onClick={() => onToggle({ id: q.id, asked: !done })}
        className="-m-3 flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-[6px] border-[1.5px]",
            done ? "border-brown-500 bg-brown-700" : "border-cream-200 bg-white",
          )}
        >
          {done && <Check size={13} strokeWidth={2.6} className="text-white" />}
        </span>
      </button>

      <span
        className={cn(
          "flex-1 text-[15px] leading-relaxed",
          done ? "text-ink-400 line-through" : "text-ink-900",
        )}
      >
        {q.text}
      </span>

      {canWrite && (
        <button
          type="button"
          aria-label={`ลบคำถาม: ${q.text}`}
          onClick={() => onDelete({ id: q.id })}
          className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400"
        >
          <Trash2 size={15} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}
