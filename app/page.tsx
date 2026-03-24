"use client";

import { useEffect, useRef, useState } from "react";

type SubBooking = { id: string; startTime: string; endTime: string };
type Availability = {
  id: string;
  startTime: string;
  endTime: string;
  bookings: SubBooking[];
};
type SubSlot = { start: Date; end: Date };

const HOUR_HEIGHT = 64;
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** 空き時間枠内で、既存予約と重ならないサブスロットを列挙 */
function getSubSlots(avail: Availability, durationMin: number): SubSlot[] {
  const slots: SubSlot[] = [];
  const durMs = durationMin * 60_000;
  let cur = new Date(avail.startTime);
  const end = new Date(avail.endTime);

  while (cur.getTime() + durMs <= end.getTime()) {
    const slotEnd = new Date(cur.getTime() + durMs);
    const conflict = avail.bookings.some(
      (b) => cur < new Date(b.endTime) && slotEnd > new Date(b.startTime)
    );
    if (!conflict) slots.push({ start: new Date(cur), end: slotEnd });
    cur = new Date(cur.getTime() + durMs);
  }
  return slots;
}

// ---- 予約モーダル ----
function BookingModal({
  avail,
  onClose,
  onSuccess,
}: {
  avail: Availability;
  onClose: () => void;
  onSuccess: (bookedSlot: SubSlot) => void;
}) {
  const totalMin = (new Date(avail.endTime).getTime() - new Date(avail.startTime).getTime()) / 60_000;
  const defaultDuration = DURATIONS.find((d) => d <= totalMin) ?? DURATIONS[0];

  const [duration, setDuration] = useState(defaultDuration);
  const [selected, setSelected] = useState<SubSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", purpose: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const subSlots = getSubSlots(avail, duration);

  // duration変更時に選択をリセット
  const prevDuration = useRef(duration);
  if (prevDuration.current !== duration) {
    prevDuration.current = duration;
    setSelected(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setStatus("submitting");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        availabilityId: avail.id,
        startTime: selected.start.toISOString(),
        endTime: selected.end.toISOString(),
        ...form,
      }),
    });
    if (res.ok) {
      onSuccess(selected);
    } else {
      const data = await res.json();
      setErrorMsg(data.error || "エラーが発生しました");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">✕</button>

        <h2 className="text-lg font-bold text-gray-800 mb-1">予約する</h2>
        <p className="text-sm text-gray-500 mb-5">
          空き枠: {fmtDateTime(avail.startTime)} 〜 {fmtTime(avail.endTime)}
        </p>

        {/* ① 時間を選ぶ */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">希望時間を選択 *</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {DURATIONS.filter((d) => d <= totalMin).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  duration === d
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {d}分
              </button>
            ))}
          </div>

          {subSlots.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">この時間帯に空きがありません</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {subSlots.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                    selected?.start.getTime() === s.start.getTime()
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
                  }`}
                >
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <p className="mt-2 text-sm text-green-700 font-medium">
              選択中: {fmtTime(selected.start)} 〜 {fmtTime(selected.end)}
            </p>
          )}
        </div>

        {/* ② 情報を入力 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">お名前 *</label>
            <input required type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="山田 太郎" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
            <input required type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目的・用件 *</label>
            <textarea required value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ご相談の内容をお書きください" />
          </div>
          {status === "error" && <p className="text-red-600 text-sm">{errorMsg}</p>}
          <button
            type="submit"
            disabled={!selected || status === "submitting"}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {status === "submitting" ? "送信中..." : "予約を確定する"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- カレンダー ----
function BookingCalendar({
  slots,
  onSelect,
}: {
  slots: Availability[];
  onSelect: (avail: Availability) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekSlots = slots.filter((s) => {
    const t = new Date(s.startTime);
    return t >= weekStart && t < weekEnd;
  });

  let minHour = 8, maxHour = 19;
  weekSlots.forEach((s) => {
    const st = new Date(s.startTime), en = new Date(s.endTime);
    minHour = Math.min(minHour, st.getHours());
    maxHour = Math.max(maxHour, en.getHours() + (en.getMinutes() > 0 ? 1 : 0));
  });
  minHour = Math.max(0, minHour - 1);
  maxHour = Math.min(24, maxHour + 1);

  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  function getSlotsForDay(day: Date) {
    const ds = day.toDateString();
    return weekSlots.filter((s) => new Date(s.startTime).toDateString() === ds);
  }

  function slotPos(s: Availability) {
    const st = new Date(s.startTime), en = new Date(s.endTime);
    const top = ((st.getHours() - minHour) + st.getMinutes() / 60) * HOUR_HEIGHT;
    const height = Math.max((en.getTime() - st.getTime()) / 3_600_000 * HOUR_HEIGHT, 22);
    return { top, height };
  }

  function bookedPos(b: SubBooking, minH: number) {
    const st = new Date(b.startTime), en = new Date(b.endTime);
    const top = ((st.getHours() - minH) + st.getMinutes() / 60) * HOUR_HEIGHT;
    const height = Math.max((en.getTime() - st.getTime()) / 3_600_000 * HOUR_HEIGHT, 4);
    return { top, height };
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const prevWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  const btnBase = "px-3 py-1 rounded-lg text-sm border border-gray-200 hover:bg-gray-100 transition-colors bg-white";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden select-none">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <button onClick={prevWeek} className={btnBase}>← 前週</button>
        <button onClick={() => setWeekStart(getMonday(new Date()))} className={btnBase}>今週</button>
        <button onClick={nextWeek} className={btnBase}>次週 →</button>
        <span className="ml-auto text-sm text-gray-500">
          {weekStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
          {" 〜 "}{days[6].toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="border-r border-gray-200" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          const isSat = i === 5, isSun = i === 6;
          const lc = isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-500";
          const nc = isToday ? "bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto"
            : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-800";
          return (
            <div key={i} className={`text-center py-2 border-l border-gray-200 ${isToday ? "bg-blue-50" : ""}`}>
              <div className={`text-xs font-medium ${lc}`}>{DAY_LABELS[i]}</div>
              <div className="text-sm font-semibold mt-0.5"><span className={nc}>{day.getDate()}</span></div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 520 }}>
        {weekSlots.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">この週に空き時間はありません</p>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: totalHeight }}>
            <div className="relative border-r border-gray-200">
              {hours.map((h) => (
                <div key={h} className="absolute w-full text-right pr-2 text-[11px] text-gray-400 leading-none"
                  style={{ top: (h - minHour) * HOUR_HEIGHT - 6 }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((day, i) => {
              const isToday = day.getTime() === today.getTime();
              const daySlots = getSlotsForDay(day);
              return (
                <div key={i} className={`relative border-l border-gray-200 ${isToday ? "bg-blue-50/20" : ""}`}
                  style={{ height: totalHeight }}>
                  {hours.map((h) => (
                    <div key={h} className="absolute w-full border-t border-gray-100"
                      style={{ top: (h - minHour) * HOUR_HEIGHT }} />
                  ))}

                  {daySlots.map((avail) => {
                    const { top, height } = slotPos(avail);
                    const hasFree = getSubSlots(avail, 10).length > 0;
                    return (
                      <div key={avail.id} className="absolute left-0.5 right-0.5" style={{ top, height, zIndex: 1 }}>
                        {/* 空き時間枠の背景 */}
                        <button
                          onClick={() => hasFree && onSelect(avail)}
                          className={`absolute inset-0 rounded px-1.5 py-0.5 text-left text-[11px] overflow-hidden transition-colors ${
                            hasFree
                              ? "bg-green-100 border border-green-300 text-green-800 hover:bg-green-200 cursor-pointer"
                              : "bg-gray-100 border border-gray-200 text-gray-400 cursor-default"
                          }`}
                        >
                          <span className="block font-medium leading-tight truncate">
                            {fmtTime(avail.startTime)}
                            {height >= 36 && <>{" – "}{fmtTime(avail.endTime)}</>}
                          </span>
                          {height >= 44 && hasFree && (
                            <span className="block text-[10px] text-green-600">予約する →</span>
                          )}
                          {height >= 44 && !hasFree && (
                            <span className="block text-[10px] text-gray-400">満席</span>
                          )}
                        </button>

                        {/* 既存予約の表示（オレンジのストライプ） */}
                        {avail.bookings.map((b) => {
                          const bp = bookedPos(b, minHour);
                          const relTop = bp.top - top;
                          return (
                            <div
                              key={b.id}
                              className="absolute left-0 right-0 bg-orange-300/60 pointer-events-none"
                              style={{ top: relTop, height: bp.height, zIndex: 2 }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-4 px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-300 inline-block" />予約可能
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-200 border border-orange-300 inline-block" />予約済み
        </span>
        <span className="ml-auto text-gray-400">スロットをクリックして予約</span>
      </div>
    </div>
  );
}

// ---- メインページ ----
export default function BookingPage() {
  const [slots, setSlots] = useState<Availability[]>([]);
  const [selectedAvail, setSelectedAvail] = useState<Availability | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  function fetchSlots() {
    fetch("/api/availability")
      .then((r) => r.json())
      .then(setSlots);
  }

  useEffect(() => { fetchSlots(); }, []);

  function handleSuccess(booked: SubSlot) {
    fetchSlots(); // 最新の予約状況をリフレッシュ
    setSelectedAvail(null);
    setSucceeded(true);
    setTimeout(() => setSucceeded(false), 5000);
  }

  // モーダルを開く際、最新データで availability を渡す
  function handleSelect(avail: Availability) {
    setSelectedAvail(avail);
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">予約ページ</h1>
        <p className="text-gray-500 mb-6">ご希望の日時をカレンダーから選択してください。</p>

        {succeeded && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-6">
            予約が完了しました。確認メールをお送りしました。
          </div>
        )}

        {slots.every((s) => getSubSlots(s, 10).length === 0) && slots.length > 0 ? (
          <p className="text-gray-500 text-center py-16">現在、空き時間がありません。</p>
        ) : slots.length === 0 ? (
          <p className="text-gray-500 text-center py-16">現在、空き時間がありません。</p>
        ) : (
          <BookingCalendar slots={slots} onSelect={handleSelect} />
        )}

        {selectedAvail && (
          <BookingModal
            avail={slots.find((s) => s.id === selectedAvail.id) ?? selectedAvail}
            onClose={() => setSelectedAvail(null)}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </main>
  );
}
