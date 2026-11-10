import Link from "next/link";
import { AlertTriangle, CircleCheck, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BAND_LABEL, expectedGainAt, rangeOf } from "@/lib/weight-gain";
import { weightAxisTicks, type WeightCardView } from "@/lib/weight-card";

/**
 * กรอบของกราฟ — หน่วยเดียวกับ viewBox ไม่ใช่พิกเซลจริง
 *
 * ขอบซ้าย 34 และสูง 150 เผื่อที่ให้ป้ายแกน ไม่ใช่เลขสุ่ม: ป้ายแกนตั้งกว้าง
 * ที่สุดคือสามหลัก (เช่น 102) ที่ fontSize 9 กินราว 15 หน่วย บวกช่องไฟ 6
 * ส่วนแกนนอนอยู่ที่ y=141 ซึ่งอยู่ใต้เส้นฐาน 128 ลงมาพอให้ไม่ชนกัน
 */
const X0 = 34;
const X1 = 310;
const Y0 = 12;
const Y1 = 128;
const WEEK_MIN = 4;
const WEEK_MAX = 40;
/** ไตรมาสละขีด — ถี่กว่านี้ป้ายจะชนกันในกราฟกว้าง 320 หน่วย */
const WEEK_TICKS = [10, 20, 30, WEEK_MAX];

const xOf = (week: number) =>
  X0 + ((Math.max(WEEK_MIN, Math.min(WEEK_MAX, week)) - WEEK_MIN) / (WEEK_MAX - WEEK_MIN)) * (X1 - X0);

/**
 * การ์ดน้ำหนักเทียบเกณฑ์ IOM
 *
 * วาดด้วย SVG ล้วน ไม่ลากไลบรารีกราฟเข้ามา ด้วยเหตุผลเดียวกับกราฟนับแคล:
 * ข้อมูลคือจุดไม่กี่สิบจุด ส่วนไลบรารีคือ JS อีกเป็นร้อย KB ที่คนใช้มือถือ
 * ต้องโหลดทุกครั้ง
 *
 * **ไม่วินิจฉัย** — บอกได้แค่ว่าอยู่ในช่วงที่คาดไว้หรือไม่ และทุกข้อความ
 * ที่ชวนให้กังวลต้องจบด้วยการชวนไปหาหมอ ไม่ใช่ชวนให้ควบคุมอาหารเอง
 */
export function WeightCard({ view }: { view: WeightCardView }) {
  if (view.state === "no_pregnancy") return null;

  if (view.state === "need_setup") {
    return (
      <Card className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-medium text-ink-900">
          <Scale size={17} strokeWidth={1.9} className="text-ink-400" />
          น้ำหนักเทียบเกณฑ์
        </span>
        <p className="text-[13px] leading-relaxed text-ink-600">
          ใส่ส่วนสูงและน้ำหนักก่อนตั้งครรภ์ แล้วระบบจะบอกได้ว่าน้ำหนักตอนนี้
          อยู่ในช่วงที่คาดไว้หรือไม่
        </p>
        <Link
          href="/profile/pregnancy"
          className="flex h-11 items-center justify-center rounded-md border border-cream-200 bg-white text-sm font-medium text-brown-700"
        >
          ใส่ข้อมูล
        </Link>
      </Card>
    );
  }

  if (view.state === "need_log") {
    const r = rangeOf(view.band);
    return (
      <Card className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 font-medium text-ink-900">
          <Scale size={17} strokeWidth={1.9} className="text-ink-400" />
          น้ำหนักเทียบเกณฑ์
        </span>
        <p className="text-[13px] leading-relaxed text-ink-600">
          BMI ก่อนตั้งครรภ์ <b className="text-ink-900">{view.bmi}</b> · {BAND_LABEL[view.band]} ·
          เกณฑ์แนะนำให้เพิ่ม {r.totalMin}–{r.totalMax} กก. ตลอดการตั้งครรภ์
        </p>
        <p className="text-[13px] text-ink-600">บันทึกน้ำหนักสักครั้งแล้วกราฟจะขึ้นให้เห็น</p>
      </Card>
    );
  }

  const { points, current, expected, status, prePregnancyWeight } = view;
  const currentKg = Math.round((prePregnancyWeight + current.gain) * 10) / 10;

  // สเกลแกนตั้งครอบทั้งเกณฑ์และน้ำหนักจริง เผื่อคนที่อยู่นอกช่วงให้เห็นตัวเองด้วย
  const topBand = expectedGainAt(view.band, WEEK_MAX).max;
  const maxGain = Math.max(topBand, ...points.map((p) => p.gain)) + 1;
  const minGain = Math.min(0, ...points.map((p) => p.gain)) - 0.5;
  const yOf = (g: number) =>
    Y1 - ((g - minGain) / (maxGain - minGain || 1)) * (Y1 - Y0);

  const weeks: number[] = [];
  for (let w = WEEK_MIN; w <= WEEK_MAX; w += 2) weeks.push(w);
  const bandTop = weeks.map((w) => `${xOf(w)},${yOf(expectedGainAt(view.band, w).max)}`);
  const bandBottom = [...weeks]
    .reverse()
    .map((w) => `${xOf(w)},${yOf(expectedGainAt(view.band, w).min)}`);

  const line = points.map((p) => `${xOf(p.week)},${yOf(p.gain)}`).join(" ");
  const ticks = weightAxisTicks(prePregnancyWeight, minGain, maxGain);
  const tone =
    status === "within"
      ? { bg: "bg-sage-100", icon: CircleCheck, text: "อยู่ในช่วงที่คาดไว้" }
      : status === "above"
        ? { bg: "bg-peach-100", icon: TrendingUp, text: "สูงกว่าช่วงที่คาดไว้" }
        : { bg: "bg-cream-100", icon: TrendingDown, text: "ต่ำกว่าช่วงที่คาดไว้" };
  const Icon = tone.icon;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-ink-900">
          <Scale size={17} strokeWidth={1.9} className="text-ink-400" />
          น้ำหนักเทียบเกณฑ์
        </span>
        <span className="text-xs text-ink-400">สัปดาห์ {current.week}</span>
      </div>

      <svg
        viewBox="0 0 320 150"
        className="w-full"
        role="img"
        aria-label={`สัปดาห์ที่ ${current.week} น้ำหนัก ${currentKg} กิโลกรัม เพิ่มมาแล้ว ${current.gain} กิโลกรัม ${tone.text}`}
      >
        {/*
          เส้นตารางแนวนอน จางพอให้ลากสายตาไปอ่านค่าบนแกนได้ แต่ไม่แย่งสายตา
          จากเส้นน้ำหนัก — ไม่มีเส้นแนวตั้ง เพราะในกราฟกว้าง 320 หน่วยมันรกเกิน
        */}
        {ticks.map((t) => (
          <line
            key={t.kg}
            x1={X0}
            y1={yOf(t.gain)}
            x2={X1}
            y2={yOf(t.gain)}
            className="stroke-cream-100"
            strokeWidth="1"
          />
        ))}
        {/* แถบคือช่วงที่เกณฑ์คาดไว้ ไม่ใช่เส้นเป้าหมายเส้นเดียว เพราะเกณฑ์เป็นช่วง */}
        <polygon
          points={[...bandTop, ...bandBottom].join(" ")}
          className="fill-sage-100"
        />
        <line x1={X0} y1={Y1} x2={X1} y2={Y1} className="stroke-cream-300" strokeWidth="1" />
        <polyline
          points={line}
          fill="none"
          className="stroke-brown-700"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xOf(current.week)} cy={yOf(current.gain)} r="4" className="fill-brown-700" />

        {/*
          แกนตั้งเป็น**น้ำหนักจริง** ไม่ใช่น้ำหนักที่เพิ่ม — ชั่งได้ 58.4 ตอนเช้า
          ก็หาตัวเองบนกราฟเจอทันที ส่วนตัวเลขที่เพิ่มยังอยู่ในข้อความใต้กราฟ
          +3 คือครึ่งความสูงของตัวอักษร 9 หน่วย เพื่อให้ป้ายอยู่กลางเส้นพอดี
        */}
        {ticks.map((t) => (
          <text
            key={t.kg}
            x={X0 - 6}
            y={yOf(t.gain) + 3}
            textAnchor="end"
            className="fill-ink-400"
            fontSize="9"
          >
            {t.kg}
          </text>
        ))}
        <text x={X0} y="9" className="fill-ink-400" fontSize="9">
          กก.
        </text>

        {WEEK_TICKS.map((w) => (
          <text
            key={w}
            x={xOf(w)}
            y="141"
            textAnchor={w === WEEK_MAX ? "end" : "middle"}
            className="fill-ink-400"
            fontSize="9"
          >
            {w === WEEK_MAX ? `${w} สัปดาห์` : w}
          </text>
        ))}
      </svg>

      <div className={`flex items-start gap-2 rounded-sm px-3 py-2.5 ${tone.bg}`}>
        <Icon size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-600" />
        <span className="text-[13px] leading-relaxed text-ink-900">
          {tone.text} · เพิ่มมาแล้ว <b>{current.gain}</b> กก.
          <span className="block text-[11px] text-ink-600">
            ช่วงที่คาดไว้ของสัปดาห์นี้ {expected.min}–{expected.max} กก. · BMI ก่อนตั้งครรภ์{" "}
            {view.bmi} ({BAND_LABEL[view.band]})
          </span>
        </span>
      </div>

      {view.fastGain && (
        <div className="flex items-start gap-2 rounded-sm bg-peach-100 px-3 py-2.5">
          <AlertTriangle size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-peach-700" />
          <span className="text-[13px] leading-relaxed text-ink-900">
            น้ำหนักขึ้นเร็วกว่า 1 กก. ต่อสัปดาห์
            <span className="block text-[11px] text-ink-600">
              เกิดจากหลายสาเหตุได้ · ถ้ามีอาการบวม ปวดหัว หรือตาพร่าร่วมด้วย ให้ปรึกษาหมอ
            </span>
          </span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-ink-400">
        เกณฑ์อ้างอิงสำหรับครรภ์เดี่ยว ไม่ใช่คำวินิจฉัย · ครรภ์แฝดใช้เกณฑ์คนละชุด
      </p>
    </Card>
  );
}
