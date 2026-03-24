"use client";

import { useEffect, useRef, useState } from "react";

type SubBooking = { id: string; startTime: string; endTime: string };

type Availability = {
  id: string;
  startTime: string;
  endTime: string;
  bookings: SubBooking[];
};

const HOUR_HEIGHT = 64;
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const MIN_SLOT_MINUTES = 10;

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtMin(totalMin: number) {
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function CalendarView({
  availabilities,
  onDelete,
  onAddSlot,
}: {
  availabilities: Availability[];
  onDelete: (id: string) => void;
  onAddSlot: (day: Date, startMin: number, endMin: number) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);
  const minHourRef = useRef(8);
  const maxHourRef = useRef(20);

  const [drag, setDrag] = useState<{
    dayIndex: number;
    day: Date;
    anchorMin: number;
    currentMin: number;
  } | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekSlots = availabilities.filter((slot) => {
    const s = new Date(slot.startTime);
    return s >= weekStart && s < weekEnd;
  });

  let minHour = 8;
  let maxHour = 19;
  weekSlots.forEach((slot) => {
    const s = new Date(slot.startTime);
    const e = new Date(slot.endTime);
    minHour = Math.min(minHour, s.getHours());
    maxHour = Math.max(maxHour, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
  });
  minHour = Math.max(0, minHour - 1);
  maxHour = Math.min(24, maxHour + 1);
  minHourRef.current = minHour;
  maxHourRef.current = maxHour;

  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  function yToMinutes(clientY: number): number {
    const el = scrollRef.current;
    if (!el) return minHourRef.current * 60;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;
    const raw = (minHourRef.current + y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(raw / 10) * 10;
    return Math.max(minHourRef.current * 60, Math.min(maxHourRef.current * 60, snapped));
  }

  function handleColumnMouseDown(e: React.MouseEvent, dayIndex: number, day: Date) {
    // スロットの削除ボタンやスロット自体のクリックは無視
    if ((e.target as HTMLElement).closest("[data-slot]")) return;
    e.preventDefault();
    const anchorMin = yToMinutes(e.clientY);
    setDrag({ dayIndex, day, anchorMin, currentMin: anchorMin + MIN_SLOT_MINUTES });
  }

  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const currentMin = yToMinutes(e.clientY);
      setDrag((prev) => (prev ? { ...prev, currentMin } : null));
    }

    function handleMouseUp(e: MouseEvent) {
      const currentMin = yToMinutes(e.clientY);
      setDrag((prev) => {
        if (!prev) return null;
        const startMin = Math.min(prev.anchorMin, currentMin);
        const endMin = Math.max(prev.anchorMin, currentMin);
        if (endMin - startMin >= MIN_SLOT_MINUTES) {
          onAddSlot(prev.day, startMin, endMin);
        }
        return null;
      });
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onAddSlot]);

  function getSlotsForDay(day: Date) {
    const dayStr = day.toDateString();
    return weekSlots.filter(
      (slot) => new Date(slot.startTime).toDateString() === dayStr
    );
  }

  function slotPosition(slot: Availability) {
    const s = new Date(slot.startTime);
    const e = new Date(slot.endTime);
    const top = ((s.getHours() - minHour) + s.getMinutes() / 60) * HOUR_HEIGHT;
    const height = Math.max((e.getTime() - s.getTime()) / 3_600_000 * HOUR_HEIGHT, 22);
    return { top, height };
  }

  // ドラッグプレビューの位置
  const preview = drag ? (() => {
    const startMin = Math.min(drag.anchorMin, drag.currentMin);
    const endMin = Math.max(drag.anchorMin, drag.currentMin);
    const top = (startMin / 60 - minHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) / 60 * HOUR_HEIGHT, HOUR_HEIGHT / 6);
    return { dayIndex: drag.dayIndex, top, height, startMin, endMin };
  })() : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevWeek = () =>
    setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () =>
    setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });

  const btnBase = "px-3 py-1 rounded-lg text-sm border border-gray-200 hover:bg-gray-100 transition-colors";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden select-none">
      {/* ナビゲーション */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <button onClick={prevWeek} className={btnBase}>← 前週</button>
        <button onClick={() => setWeekStart(getMonday(new Date()))} className={btnBase}>今週</button>
        <button onClick={nextWeek} className={btnBase}>次週 →</button>
        <span className="ml-auto text-sm text-gray-600">
          {weekStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
          {" 〜 "}
          {days[6].toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
        </span>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="border-r border-gray-200" />
        {days.map((day, i) => {
          const isToday = day.getTime() === today.getTime();
          const isSat = i === 5;
          const isSun = i === 6;
          const labelColor = isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-500";
          const numClass = isToday
            ? "bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto"
            : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-800";
          return (
            <div key={i} className={`text-center py-2 border-l border-gray-200 ${isToday ? "bg-blue-50" : ""}`}>
              <div className={`text-xs font-medium ${labelColor}`}>{DAY_LABELS[i]}</div>
              <div className="text-sm font-semibold mt-0.5">
                <span className={numClass}>{day.getDate()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* タイムグリッド */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: totalHeight }}>
          {/* 時刻ラベル */}
          <div className="relative border-r border-gray-200">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-2 text-[11px] text-gray-400 leading-none"
                style={{ top: (h - minHour) * HOUR_HEIGHT - 6 }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 各曜日列 */}
          {days.map((day, i) => {
            const isToday = day.getTime() === today.getTime();
            const slots = getSlotsForDay(day);
            const isDragCol = drag?.dayIndex === i;
            return (
              <div
                key={i}
                className={`relative border-l border-gray-200 ${isToday ? "bg-blue-50/20" : ""} ${isDragging ? (isDragCol ? "cursor-ns-resize" : "cursor-not-allowed") : "cursor-crosshair"}`}
                style={{ height: totalHeight }}
                onMouseDown={(e) => handleColumnMouseDown(e, i, day)}
              >
                {/* 時間線 */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-gray-100"
                    style={{ top: (h - minHour) * HOUR_HEIGHT }}
                  />
                ))}

                {/* 既存スロット */}
                {slots.map((slot) => {
                  const { top, height } = slotPosition(slot);
                  const hasBookings = slot.bookings.length > 0;
                  return (
                    <div
                      key={slot.id}
                      data-slot="true"
                      className="absolute left-0.5 right-0.5 bg-blue-100 border border-blue-300 text-blue-700 rounded px-1.5 py-0.5 text-[11px] group overflow-hidden"
                      style={{ top, height, zIndex: 1 }}
                    >
                      <div className="flex items-start justify-between gap-0.5 leading-tight">
                        <span className="truncate font-medium">
                          {new Date(slot.startTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          {height >= 36 && (
                            <>{" – "}{new Date(slot.endTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</>
                          )}
                        </span>
                        {!hasBookings && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                            className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-red-500 shrink-0 leading-none cursor-pointer"
                            title="削除"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {hasBookings && height >= 36 && (
                        <span className="block text-[10px] text-blue-500 truncate">予約{slot.bookings.length}件</span>
                      )}

                      {/* サブ予約ブロック */}
                      {slot.bookings.map((b) => {
                        const bs = new Date(b.startTime), be = new Date(b.endTime);
                        const bTop = ((bs.getHours() - minHour) + bs.getMinutes() / 60) * HOUR_HEIGHT - top;
                        const bHeight = Math.max((be.getTime() - bs.getTime()) / 3_600_000 * HOUR_HEIGHT, 4);
                        return (
                          <div
                            key={b.id}
                            className="absolute left-0 right-0 bg-orange-300/70 pointer-events-none"
                            style={{ top: bTop, height: bHeight }}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* ドラッグプレビュー */}
                {preview && preview.dayIndex === i && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded border-2 border-blue-500 bg-blue-200/60 pointer-events-none overflow-hidden"
                    style={{ top: preview.top, height: preview.height, zIndex: 2 }}
                  >
                    <span className="block px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 leading-tight">
                      {fmtMin(preview.startMin)} – {fmtMin(preview.endMin)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300 inline-block" />
          空き
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-200 border border-orange-300 inline-block" />
          予約済み
        </span>
        <span className="ml-auto text-gray-400">日付欄をドラッグして空き時間を追加</span>
      </div>
    </div>
  );
}
