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

function fmtDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "long", day: "numeric", weekday: "short",
  });
}

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

  const prevDuration = useRef(duration);
  if (prevDuration.current !== duration) {
    prevDuration.current = duration;
    setSelected(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setErrorMsg("希望の開始時刻を選択してください");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
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
        const data = await res.json().catch(() => ({ error: "サーバーエラーが発生しました" }));
        setErrorMsg(data.error || "エラーが発生しました");
        setStatus("error");
      }
    } catch {
      setErrorMsg("通信エラーが発生しました。もう一度お試しください。");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">

        {/* モーダルヘッダー */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-0.5">{fmtDate(avail.startTime)}</p>
            <h2 className="text-base font-semibold text-gray-900">
              {fmtTime(avail.startTime)} 〜 {fmtTime(avail.endTime)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ステップ1: 時間選択 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">1. 時間を選択</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DURATIONS.filter((d) => d <= totalMin).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    duration === d
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {d}分
                </button>
              ))}
            </div>

            {subSlots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">この時間帯に空きがありません</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {subSlots.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(s)}
                    className={`py-2 rounded-md text-xs font-medium border transition-colors ${
                      selected?.start.getTime() === s.start.getTime()
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {fmtTime(s.start)}
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-md px-3 py-1.5">
                <span>✓</span>
                <span>{fmtTime(selected.start)} 〜 {fmtTime(selected.end)}（{duration}分）</span>
              </div>
            )}
          </div>

          {/* ステップ2: 情報入力 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">2. お客様情報</p>
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">お名前 <span className="text-red-400">*</span></label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">メールアドレス <span className="text-red-400">*</span></label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                  placeholder="example@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">目的・用件 <span className="text-red-400">*</span></label>
                <textarea
                  required
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 resize-none"
                  placeholder="ご相談の内容をお書きください"
                />
              </div>
              {status === "error" && (
                <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {status === "submitting" ? "送信中..." : "予約を確定する"}
              </button>
            </form>
          </div>
        </div>
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden select-none">
      {/* ナビゲーション */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700 mr-1">
          {weekStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
        </span>
        <button
          onClick={prevWeek}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-base"
        >
          ‹
        </button>
        <button
          onClick={() => setWeekStart(getMonday(new Date()))}
          className="px-2.5 py-0.5 rounded-md border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
        >
          今週
        </button>
        <button
          onClick={nextWeek}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-base"
        >
          ›
        </button>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" />予約可能
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />満席
          </span>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "40px repeat(7, 1fr)" }}>
        <div className="border-r border-gray-100" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          const isSat = i === 5, isSun = i === 6;
          const dayColor = isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-500";
          const numClass = isToday
            ? "bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs font-bold"
            : `text-xs font-semibold ${isSun ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-800"}`;
          return (
            <div key={i} className={`text-center py-1.5 border-l border-gray-100 ${isToday ? "bg-indigo-50/30" : ""}`}>
              <div className={`text-[10px] font-medium ${dayColor}`}>{DAY_LABELS[i]}</div>
              <div className="mt-0.5"><span className={numClass}>{day.getDate()}</span></div>
            </div>
          );
        })}
      </div>

      {/* タイムグリッド */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 480 }}>
        {weekSlots.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-300 text-3xl mb-2">—</p>
            <p className="text-gray-400 text-sm">この週に空き時間はありません</p>
            <p className="text-gray-300 text-xs mt-1">前後の週をご確認ください</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "40px repeat(7, 1fr)", height: totalHeight }}>
            <div className="relative border-r border-gray-100">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2 text-[10px] text-gray-300 leading-none"
                  style={{ top: (h - minHour) * HOUR_HEIGHT - 5 }}
                >
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>

            {days.map((day, i) => {
              const isToday = day.getTime() === today.getTime();
              const daySlots = getSlotsForDay(day);
              return (
                <div
                  key={i}
                  className={`relative border-l border-gray-100 ${isToday ? "bg-indigo-50/20" : ""}`}
                  style={{ height: totalHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-gray-50"
                      style={{ top: (h - minHour) * HOUR_HEIGHT }}
                    />
                  ))}

                  {daySlots.map((avail) => {
                    const { top, height } = slotPos(avail);
                    const hasFree = getSubSlots(avail, 10).length > 0;
                    return (
                      <div key={avail.id} className="absolute left-0.5 right-0.5" style={{ top, height, zIndex: 1 }}>
                        <button
                          onClick={() => hasFree && onSelect(avail)}
                          className={`absolute inset-0 rounded-md px-1.5 py-1 text-left text-[11px] overflow-hidden transition-colors ${
                            hasFree
                              ? "bg-indigo-500 border border-indigo-400 text-white hover:bg-indigo-600 cursor-pointer"
                              : "bg-gray-100 border border-gray-200 text-gray-400 cursor-default"
                          }`}
                        >
                          <span className="block font-medium leading-tight truncate">
                            {fmtTime(avail.startTime)}
                            {height >= 36 && <>{" – "}{fmtTime(avail.endTime)}</>}
                          </span>
                          {height >= 44 && hasFree && (
                            <span className="block text-[10px] text-indigo-200 mt-0.5">タップして予約</span>
                          )}
                          {height >= 44 && !hasFree && (
                            <span className="block text-[10px] text-gray-400">満席</span>
                          )}
                        </button>

                        {avail.bookings.map((b) => {
                          const bp = bookedPos(b, minHour);
                          const relTop = bp.top - top;
                          return (
                            <div
                              key={b.id}
                              className="absolute left-0 right-0 bg-white/25 pointer-events-none"
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
    </div>
  );
}

// ---- メインページ ----
export default function BookingPage() {
  const [slots, setSlots] = useState<Availability[]>([]);
  const [selectedAvail, setSelectedAvail] = useState<Availability | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<SubSlot | null>(null);

  function fetchSlots() {
    fetch("/api/availability")
      .then((r) => r.json())
      .then(setSlots);
  }

  useEffect(() => { fetchSlots(); }, []);

  function handleSuccess(booked: SubSlot) {
    fetchSlots();
    setSelectedAvail(null);
    setBookedSlot(booked);
    setSucceeded(true);
    setTimeout(() => { setSucceeded(false); setBookedSlot(null); }, 8000);
  }

  const noSlots =
    slots.length === 0 || slots.every((s) => getSubSlots(s, 10).length === 0);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">ご予約</h1>
            <p className="text-xs text-gray-400">日時を選択して予約してください</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            受付中
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {/* 予約完了バナー */}
        {succeeded && bookedSlot && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-emerald-500 text-lg">✓</span>
            <div>
              <p className="text-sm font-medium text-emerald-800">予約が完了しました</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {fmtDate(bookedSlot.start)}　{fmtTime(bookedSlot.start)} 〜 {fmtTime(bookedSlot.end)}
              </p>
            </div>
          </div>
        )}

        {noSlots ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">現在、空き時間がありません</p>
            <p className="text-gray-300 text-xs mt-1">しばらく後にまたご確認ください。</p>
          </div>
        ) : (
          <BookingCalendar slots={slots} onSelect={setSelectedAvail} />
        )}
      </div>

      {selectedAvail && (
        <BookingModal
          avail={slots.find((s) => s.id === selectedAvail.id) ?? selectedAvail}
          onClose={() => setSelectedAvail(null)}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  );
}
