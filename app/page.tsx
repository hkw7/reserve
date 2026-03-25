"use client";

import { useEffect, useRef, useState } from "react";
import "./booking.css";

type SubBooking = { id: string; startTime: string; endTime: string };
type Availability = {
  id: string;
  startTime: string;
  endTime: string;
  bookings: SubBooking[];
};
type SubSlot = { start: Date; end: Date };

const HOUR_HEIGHT = 64;
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

function getSunday(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
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

// ── 予約モーダル ──────────────────────────────────────────────────

function BookingModal({
  avail,
  onClose,
  onSuccess,
}: {
  avail: Availability;
  onClose: () => void;
  onSuccess: (bookedSlot: SubSlot) => void;
}) {
  const totalMin =
    (new Date(avail.endTime).getTime() - new Date(avail.startTime).getTime()) / 60_000;
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
    <div className="salon-modal-overlay" onClick={onClose}>
      <div className="salon-modal" onClick={(e) => e.stopPropagation()}>
        <button className="salon-modal-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>

        {/* ヘッダー */}
        <div className="salon-modal-header">
          <p className="salon-modal-date">{fmtDate(avail.startTime)}</p>
          <h2 className="salon-modal-time">
            {fmtTime(avail.startTime)}{" "}
            <span className="salon-em">—</span>{" "}
            {fmtTime(avail.endTime)}
          </h2>
          <div className="salon-modal-divider" />
        </div>

        {/* ステップ1: 時間 */}
        <div className="salon-modal-section">
          <p className="salon-step-label">ご希望の時間</p>
          <div className="salon-duration-grid">
            {DURATIONS.filter((d) => d <= totalMin).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`salon-duration-btn${duration === d ? " active" : ""}`}
              >
                {d}<span className="salon-unit">分</span>
              </button>
            ))}
          </div>

          {subSlots.length === 0 ? (
            <p className="salon-empty-slots">この時間帯に空きはございません</p>
          ) : (
            <div className="salon-time-grid">
              {subSlots.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`salon-time-btn${
                    selected?.start.getTime() === s.start.getTime() ? " active" : ""
                  }`}
                >
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="salon-selected-time">
              <span className="salon-check">✓</span>
              {fmtTime(selected.start)} — {fmtTime(selected.end)}（{duration}分）
            </div>
          )}
        </div>

        {/* ステップ2: 情報入力 */}
        <div className="salon-modal-section">
          <p className="salon-step-label">お客様のご情報</p>
          <form onSubmit={handleSubmit} className="salon-form">
            <div className="salon-field">
              <label className="salon-label">
                お名前 <span className="salon-required">*</span>
              </label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="salon-input"
                placeholder="山田 太郎"
              />
            </div>
            <div className="salon-field">
              <label className="salon-label">
                メールアドレス <span className="salon-required">*</span>
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="salon-input"
                placeholder="example@example.com"
              />
            </div>
            <div className="salon-field">
              <label className="salon-label">
                目的・用件 <span className="salon-required">*</span>
              </label>
              <textarea
                required
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                rows={3}
                className="salon-input salon-textarea"
                placeholder="ご相談の内容をお書きください"
              />
            </div>
            {status === "error" && (
              <p className="salon-error">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="salon-submit"
            >
              {status === "submitting" ? "送信中..." : "予約を確定する"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── カレンダー ────────────────────────────────────────────────────

function BookingCalendar({
  slots,
  onSelect,
}: {
  slots: Availability[];
  onSelect: (avail: Availability) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getSunday(new Date()));
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
  const prevWeek = () =>
    setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () =>
    setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });

  return (
    <div className="salon-calendar">
      {/* ナビゲーション */}
      <div className="salon-cal-nav">
        <span className="salon-cal-month">
          {weekStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long" })}
        </span>
        <div className="salon-cal-controls">
          <button onClick={prevWeek} className="salon-nav-btn">‹</button>
          <button
            onClick={() => setWeekStart(getSunday(new Date()))}
            className="salon-today-btn"
          >
            今週
          </button>
          <button onClick={nextWeek} className="salon-nav-btn">›</button>
        </div>
        <div className="salon-legend">
          <span className="salon-legend-item">
            <span className="salon-legend-dot available" />予約可
          </span>
          <span className="salon-legend-item">
            <span className="salon-legend-dot full" />満席
          </span>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div
        className="salon-day-headers"
        style={{ gridTemplateColumns: "40px repeat(7, 1fr)" }}
      >
        <div className="salon-time-col-header" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          const isSun = i === 0, isSat = i === 6;
          return (
            <div
              key={i}
              className={`salon-day-header${isToday ? " today" : ""}${
                isSun ? " sun" : isSat ? " sat" : ""
              }`}
            >
              <span className="salon-day-name">{DAY_LABELS[i]}</span>
              <span className="salon-day-num">{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* タイムグリッド */}
      <div ref={scrollRef} className="salon-grid-scroll">
        {weekSlots.length === 0 ? (
          <div className="salon-empty-week">
            <p className="salon-empty-symbol">◇</p>
            <p className="salon-empty-text">この週に空き時間はございません</p>
            <p className="salon-empty-sub">前後の週をご確認ください</p>
          </div>
        ) : (
          <div
            className="salon-grid"
            style={{ gridTemplateColumns: "40px repeat(7, 1fr)", height: totalHeight }}
          >
            {/* 時刻ラベル */}
            <div className="salon-hour-col">
              {hours.map((h) => (
                <div
                  key={h}
                  className="salon-hour-label"
                  style={{ top: (h - minHour) * HOUR_HEIGHT - 7 }}
                >
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>

            {/* 日列 */}
            {days.map((day, i) => {
              const isToday = day.getTime() === today.getTime();
              const daySlots = getSlotsForDay(day);
              return (
                <div
                  key={i}
                  className={`salon-day-col${isToday ? " today" : ""}`}
                  style={{ height: totalHeight }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="salon-hour-line"
                      style={{ top: (h - minHour) * HOUR_HEIGHT }}
                    />
                  ))}

                  {daySlots.map((avail) => {
                    const { top, height } = slotPos(avail);
                    const hasFree = getSubSlots(avail, 10).length > 0;
                    return (
                      <div
                        key={avail.id}
                        style={{
                          position: "absolute",
                          top,
                          height,
                          left: 2,
                          right: 2,
                          zIndex: 1,
                        }}
                      >
                        <button
                          onClick={() => hasFree && onSelect(avail)}
                          className={`salon-slot${hasFree ? " available" : " full"}`}
                          style={{ position: "absolute", inset: 0 }}
                        >
                          <span className="salon-slot-time">
                            {fmtTime(avail.startTime)}
                            {height >= 36 && <>{" — "}{fmtTime(avail.endTime)}</>}
                          </span>
                          {height >= 44 && (
                            <span className="salon-slot-sub">
                              {hasFree ? "予約する" : "満席"}
                            </span>
                          )}
                        </button>

                        {avail.bookings.map((b) => {
                          const bp = bookedPos(b, minHour);
                          return (
                            <div
                              key={b.id}
                              className="salon-booked-overlay"
                              style={{
                                position: "absolute",
                                top: bp.top - top,
                                height: bp.height,
                                left: 0,
                                right: 0,
                                zIndex: 2,
                              }}
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

// ── メインページ ──────────────────────────────────────────────────

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
    <main className="salon-page">
      <div className="salon-bg-texture" />

      {/* ヘッダー */}
      <header className="salon-header">
        <div className="salon-header-eyebrow">
          <span className="salon-status-dot" />
          受付中
        </div>
        <h1 className="salon-title">
          ご<em>予約</em>
        </h1>
        <p className="salon-subtitle">
          日時を選択してスケジュールを調整できます
        </p>
      </header>

      {/* コンテンツ */}
      <div className="salon-content">
        {/* 予約完了バナー */}
        {succeeded && bookedSlot && (
          <div className="salon-success">
            <span className="salon-success-icon">✓</span>
            <div>
              <p className="salon-success-title">ご予約が完了いたしました</p>
              <p className="salon-success-detail">
                {fmtDate(bookedSlot.start)}　{fmtTime(bookedSlot.start)} — {fmtTime(bookedSlot.end)}
              </p>
            </div>
          </div>
        )}

        {noSlots ? (
          <div className="salon-no-slots">
            <p className="salon-no-slots-sym">◇</p>
            <p className="salon-no-slots-text">現在、空き時間がございません</p>
            <p className="salon-no-slots-sub">しばらく後にまたご確認ください</p>
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
