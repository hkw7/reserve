"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarView } from "./CalendarView";

// 00:00〜23:50 を10分刻みで生成
const TIME_OPTIONS = Array.from({ length: 144 }, (_, i) => {
  const h = String(Math.floor(i / 6)).padStart(2, "0");
  const m = String((i % 6) * 10).padStart(2, "0");
  return `${h}:${m}`;
});

function TimeSelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [manual, setManual] = useState(false);

  return (
    <div className="flex gap-1 items-center">
      {manual ? (
        <input
          required={required}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">--:--</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => { setManual((m) => !m); onChange(""); }}
        className="text-xs text-gray-400 hover:text-blue-600 whitespace-nowrap px-1"
        title={manual ? "選択に戻す" : "手入力"}
      >
        {manual ? "選択" : "手入力"}
      </button>
    </div>
  );
}

type SubBooking = { id: string; startTime: string; endTime: string };

type Availability = {
  id: string;
  startTime: string;
  endTime: string;
  bookings: SubBooking[];
};

type Booking = {
  id: string;
  name: string;
  email: string;
  purpose: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  availability: Availability;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newSlot, setNewSlot] = useState({ startDate: "", startTime: "", endDate: "", endTime: "", repeatUntil: "" });
  const [repeatMode, setRepeatMode] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [slotSuccess, setSlotSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"bookings" | "slots">("bookings");
  const [slotsView, setSlotsView] = useState<"list" | "calendar">("calendar");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/admin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchAvailabilities();
      fetchBookings();
    }
  }, [session]);

  async function fetchAvailabilities() {
    const res = await fetch("/api/availability");
    const data = await res.json();
    setAvailabilities(data);
  }

  async function fetchBookings() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data);
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setSlotError("");
    setSlotSuccess("");

    const startDateTime = new Date(`${newSlot.startDate}T${newSlot.startTime}`).toISOString();
    const endDateTime = new Date(
      repeatMode
        ? `${newSlot.startDate}T${newSlot.endTime}`
        : `${newSlot.endDate}T${newSlot.endTime}`
    ).toISOString();

    // repeatUntil は「その日の終わり（現地時間）」としてISOに変換
    const repeatUntilISO = newSlot.repeatUntil
      ? (() => { const d = new Date(`${newSlot.repeatUntil}T23:59:59`); return d.toISOString(); })()
      : undefined;

    const body = repeatMode
      ? { startTime: startDateTime, endTime: endDateTime, repeatUntil: repeatUntilISO }
      : { startTime: startDateTime, endTime: endDateTime };

    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setNewSlot({ startDate: "", startTime: "", endDate: "", endTime: "", repeatUntil: "" });
      if (repeatMode && data.created) {
        setSlotSuccess(`${data.created}件の時間枠を追加しました。`);
      }
      fetchAvailabilities();
    } else {
      const data = await res.json();
      setSlotError(data.error || "エラーが発生しました");
    }
  }

  async function deleteSlot(id: string) {
    if (!confirm("この時間枠を削除しますか？")) return;
    await fetch(`/api/availability/${id}`, { method: "DELETE" });
    fetchAvailabilities();
  }

  async function addSlotFromCalendar(day: Date, startMin: number, endMin: number) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const startTime = new Date(`${dateStr}T${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`).toISOString();
    const endTime = new Date(`${dateStr}T${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`).toISOString();
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime, endTime }),
    });
    if (res.ok) fetchAvailabilities();
  }

  async function cancelBooking(id: string) {
    if (!confirm("この予約をキャンセルしますか？")) return;
    await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    fetchBookings();
    fetchAvailabilities();
  }

  if (status === "loading" || !session) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">管理者ダッシュボード</h1>
        <button
          onClick={() => signOut({ callbackUrl: "/admin" })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ログアウト
        </button>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* タブ */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "bookings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            予約一覧 ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab("slots")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "slots"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            空き時間管理 ({availabilities.length})
          </button>
        </div>

        {/* 予約一覧 */}
        {activeTab === "bookings" && (
          <section>
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-center py-16">予約はまだありません。</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{b.name}</p>
                        <p className="text-sm text-gray-500">{b.email}</p>
                        <p className="text-sm text-gray-600 mt-1">{b.purpose}</p>
                        <p className="text-sm text-blue-600 mt-2">
                          {fmt(b.startTime)} 〜 {fmt(b.endTime)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">予約日: {fmt(b.createdAt)}</p>
                      </div>
                      <button
                        onClick={() => cancelBooking(b.id)}
                        className="text-sm text-red-500 hover:text-red-700 ml-4"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 空き時間管理 */}
        {activeTab === "slots" && (
          <section>
            {/* ビュー切り替え */}
            <div className="flex justify-end mb-4 gap-1">
              <button
                onClick={() => setSlotsView("calendar")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  slotsView === "calendar"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                カレンダー
              </button>
              <button
                onClick={() => setSlotsView("list")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  slotsView === "list"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                リスト
              </button>
            </div>

            {/* カレンダービュー */}
            {slotsView === "calendar" && (
              <div className="mb-6">
                <CalendarView availabilities={availabilities} onDelete={deleteSlot} onAddSlot={addSlotFromCalendar} />
              </div>
            )}

            {/* 追加フォーム */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700">新しい時間枠を追加</h2>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={repeatMode}
                    onChange={(e) => {
                      setRepeatMode(e.target.checked);
                      setSlotError("");
                      setSlotSuccess("");
                    }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  毎日繰り返し
                </label>
              </div>
              <form onSubmit={addSlot} className="flex flex-col gap-3">
                {/* 開始 */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      {repeatMode ? "開始日（初日）" : "開始日"}
                    </label>
                    <input
                      required
                      type="date"
                      value={newSlot.startDate}
                      onChange={(e) => setNewSlot({ ...newSlot, startDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">開始時刻</label>
                    <TimeSelect
                      required
                      value={newSlot.startTime}
                      onChange={(v) => setNewSlot({ ...newSlot, startTime: v })}
                    />
                  </div>
                </div>

                {/* 終了 */}
                <div className="flex gap-2">
                  {!repeatMode && (
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">終了日</label>
                      <input
                        required
                        type="date"
                        value={newSlot.endDate}
                        onChange={(e) => setNewSlot({ ...newSlot, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">終了時刻</label>
                    <TimeSelect
                      required
                      value={newSlot.endTime}
                      onChange={(v) => setNewSlot({ ...newSlot, endTime: v })}
                    />
                  </div>
                  {repeatMode && (
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">繰り返し終了日</label>
                      <input
                        required
                        type="date"
                        value={newSlot.repeatUntil}
                        onChange={(e) => setNewSlot({ ...newSlot, repeatUntil: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {repeatMode && newSlot.startDate && newSlot.startTime && newSlot.endTime && newSlot.repeatUntil && (
                  <p className="text-xs text-gray-500">
                    {newSlot.startDate} 〜 {newSlot.repeatUntil} の毎日{" "}
                    {newSlot.startTime} 〜 {newSlot.endTime} に追加されます
                  </p>
                )}

                <button
                  type="submit"
                  className="self-end bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {repeatMode ? "まとめて追加" : "追加"}
                </button>
              </form>
              {slotError && <p className="text-red-600 text-sm mt-2">{slotError}</p>}
              {slotSuccess && <p className="text-green-600 text-sm mt-2">{slotSuccess}</p>}
            </div>

            {/* 時間枠一覧（リストビュー時のみ） */}
            {slotsView === "list" && availabilities.length === 0 ? (
              <p className="text-gray-500 text-center py-10">時間枠がありません。上から追加してください。</p>
            ) : slotsView === "list" ? (
              <div className="space-y-2">
                {availabilities.map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-sm text-gray-700">
                        {fmt(slot.startTime)} 〜 {fmt(slot.endTime)}
                      </span>
                      {slot.bookings.length > 0 && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          予約{slot.bookings.length}件
                        </span>
                      )}
                    </div>
                    {slot.bookings.length === 0 && (
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
