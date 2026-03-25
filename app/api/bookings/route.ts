import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, sendBookingNotificationToAdmin } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    orderBy: { startTime: "asc" },
    include: { availability: true },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  // レートリミット（10分間に5件まで）
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { allowed, retryAfterSec } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく時間をおいてから再度お試しください。" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const { availabilityId, startTime, endTime, name, email, purpose } = await req.json();

  if (!availabilityId || !startTime || !endTime || !name || !email || !purpose)
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });

  // 入力値の最大長バリデーション
  if (name.length > 100)
    return NextResponse.json({ error: "お名前は100文字以内で入力してください" }, { status: 400 });
  if (email.length > 254)
    return NextResponse.json({ error: "メールアドレスが長すぎます" }, { status: 400 });
  if (purpose.length > 1000)
    return NextResponse.json({ error: "目的・用件は1000文字以内で入力してください" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(endTime);

  const availability = await prisma.availability.findUnique({
    where: { id: availabilityId },
    include: { bookings: true },
  });

  if (!availability)
    return NextResponse.json({ error: "指定の時間枠が見つかりません" }, { status: 404 });

  if (start < availability.startTime || end > availability.endTime)
    return NextResponse.json({ error: "指定の時間帯が空き時間枠の範囲外です" }, { status: 400 });

  // 重複チェック
  const conflict = availability.bookings.some(
    (b) => start < b.endTime && end > b.startTime
  );
  if (conflict)
    return NextResponse.json({ error: "この時間帯は既に予約済みです" }, { status: 409 });

  const booking = await prisma.booking.create({
    data: { availabilityId, startTime: start, endTime: end, name, email, purpose },
  });

  try {
    await Promise.all([
      sendBookingConfirmation({ to: email, name, purpose, startTime: start, endTime: end }),
      sendBookingNotificationToAdmin({ name, email, purpose, startTime: start, endTime: end }),
    ]);
  } catch (err) {
    console.error("メール送信エラー:", err);
  }

  return NextResponse.json(booking, { status: 201 });
}
