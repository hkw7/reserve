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

function fmtDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-6 pt-6 pb-8 rounded-t-3xl sm:rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-widest mb-1">予約日時</p>
          <h2 className="text-white text-xl font-bold">{fmtDate(avail.startTime)}</h2>
          <p className="text-indigo-100 text-sm mt-0.5">
            {fmtTime(avail.startTime)} 〜 {fmtTime(avail.endTime)}
          </p>
        </div>

        <div className="px-6 py-5 -mt-3">
          {/* ステップ1: 時間選択 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-sm font-semibold text-gray-700">希望の時間を選択</span>
            </div>

            {/* 時間選択 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DURATIONS.filter((d) => d <= totalMin).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                    duration === d
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {d}分
                </button>
              ))}
            </div>

            {subSlots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">この時間帯に空きがありません</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {subSlots.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(s)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                      selected?.start.getTime() === s.start.getTime()
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105"
                        : "bg-gray-50 text-gray-700 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    {fmtTime(s.start)}
                  </button>
                ))}
              </div>
            )}

            {selected ? (
              <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-indigo-500 text-base">✓</span>
                <span className="text-indigo-700 text-sm font-medium">
                  {fmtTime(selected.start)} 〜 {fmtTime(selected.end)}（{duration}分）
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                上のグリッドから開始時刻を選択してください
              </p>
            )}
          </div>

          {/* ステップ2: 情報入力 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-sm font-semibold text-gray-700">お客様情報を入力</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">お名前 *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">メールアドレス *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
                  placeholder="example@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">目的・用件 *</label>
                <textarea
                  required
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 focus:bg-white transition-colors resize-none"
                  placeholder="ご相談の内容をお書きください"
                />
              </div>
              {status === "error" && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-blue-600 disabled:opacity-40 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {status === "submitting" ? "送信中..." : "予約を確定する →"}
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden select-none">
      {/* カレンダーナビゲーション */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button
          onClick={prevWeek}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm"
        >
          ‹
        </button>
        <button
          onClick={() => setWeekStart(getMonday(new Date()))}
          className="px-3 py-1 rounded-full border border-gray-200 text-gray-500 text-xs hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          今週
        </button>
        <button
          onClick={nextWeek}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm"
        >
          ›
        </button>
        <span className="ml-auto text-sm font-medium text-gray-600">
          {weekStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
        </span>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}>
        <div className="border-r border-gray-100" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          const isSat = i === 5, isSun = i === 6;
          const lc = isSun ? "text-red-400" : isSat ? "text-blue-400" : "text-gray-400";
          const nc = isToday
            ? "bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto text-sm font-bold"
            : isSun ? "text-red-500 font-semibold" : isSat ? "text-blue-500 font-semibold" : "text-gray-700 font-semibold";
          return (
            <div key={i} className={`text-center py-2 border-l border-gray-100 ${isToday ? "bg-indigo-50/50" : ""}`}>
              <div className={`text-[11px] font-medium ${lc}`}>{DAY_LABELS[i]}</div>
              <div className="text-sm mt-0.5"><span className={nc}>{day.getDate()}</span></div>
            </div>
          );
        })}
      </div>

      {/* タイムグリッド */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 520 }}>
        {weekSlots.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-gray-400 text-sm">この週に空き時間はありません</p>
            <p className="text-gray-300 text-xs mt-1">前後の週をご確認ください</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, 1fr)", height: totalHeight }}>
            <div className="relative border-r border-gray-100">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-2 text-[10px] text-gray-300 leading-none"
                  style={{ top: (h - minHour) * HOUR_HEIGHT - 5 }}
                >
                  {String(h).padStart(2, "0")}:00
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
                          className={`absolute inset-0 rounded-lg px-1.5 py-1 text-left text-[11px] overflow-hidden transition-all ${
                            hasFree
                              ? "bg-gradient-to-b from-emerald-400 to-emerald-500 border border-emerald-400 text-white hover:from-emerald-500 hover:to-emerald-600 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98]"
                              : "bg-gray-100 border border-gray-200 text-gray-400 cursor-default"
                          }`}
                        >
                          <span className="block font-semibold leading-tight truncate">
                            {fmtTime(avail.startTime)}
                            {height >= 36 && <>{" – "}{fmtTime(avail.endTime)}</>}
                          </span>
                          {height >= 44 && hasFree && (
                            <span className="block text-[10px] text-emerald-100 mt-0.5">タップして予約</span>
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
                              className="absolute left-0 right-0 bg-white/30 pointer-events-none"
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

      {/* 凡例 */}
      <div className="flex gap-4 px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />予約可能
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-200 inline-block" />満席
        </span>
        <span className="ml-auto">スロットをクリックして予約</span>
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
    <main className="min-h-screen bg-slate-50">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <p className="text-indigo-200 text-sm font-medium tracking-wider uppercase mb-2">Online Booking</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
            ご予約はこちらから
          </h1>
          <p className="text-indigo-100 text-base sm:text-lg max-w-lg leading-relaxed">
            ご希望の日時をカレンダーから選択し、必要事項をご入力ください。確認メールをお送りします。
          </p>

          {/* ステップ表示 */}
          <div className="flex items-center gap-2 mt-6 text-sm text-indigo-200">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">1</span>
              日時を選ぶ
            </span>
            <span className="text-indigo-400">→</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">2</span>
              情報を入力
            </span>
            <span className="text-indigo-400">→</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">3</span>
              予約完了
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 予約完了バナー */}
        {succeeded && bookedSlot && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="font-semibold text-emerald-800 text-base">予約が完了しました！</p>
              <p className="text-emerald-600 text-sm mt-0.5">
                {fmtDate(bookedSlot.start)}　{fmtTime(bookedSlot.start)} 〜 {fmtTime(bookedSlot.end)}
              </p>
              <p className="text-emerald-500 text-xs mt-1">確認メールをお送りしました。</p>
            </div>
          </div>
        )}

        {/* 空き時間なし */}
        {noSlots ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-gray-500 text-lg font-medium">現在、空き時間がありません</p>
            <p className="text-gray-400 text-sm mt-1">しばらく後にまたご確認ください。</p>
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
