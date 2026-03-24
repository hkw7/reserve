import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const availabilities = await prisma.availability.findMany({
    where: { endTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: {
      bookings: { select: { id: true, startTime: true, endTime: true } },
    },
  });
  return NextResponse.json(availabilities);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { startTime, endTime, repeatUntil } = await req.json();
  if (!startTime || !endTime)
    return NextResponse.json({ error: "startTime and endTime are required" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start)
    return NextResponse.json({ error: "終了日時は開始日時より後にしてください" }, { status: 400 });

  if (!repeatUntil) {
    // 重複する既存スロットを検索（予約なしのもののみ結合対象）
    const overlapping = await prisma.availability.findMany({
      where: { startTime: { lt: end }, endTime: { gt: start } },
      include: { bookings: { select: { id: true } } },
    });
    const mergeable = overlapping.filter((s) => s.bookings.length === 0);

    const mergedStart = mergeable.reduce((min, s) => (s.startTime < min ? s.startTime : min), start);
    const mergedEnd = mergeable.reduce((max, s) => (s.endTime > max ? s.endTime : max), end);

    const availability = await prisma.$transaction(async (tx) => {
      if (mergeable.length > 0) {
        await tx.availability.deleteMany({ where: { id: { in: mergeable.map((s) => s.id) } } });
      }
      return tx.availability.create({ data: { startTime: mergedStart, endTime: mergedEnd } });
    });
    return NextResponse.json(availability, { status: 201 });
  }

  // repeatUntil はクライアント側でISO変換済み
  const until = new Date(repeatUntil);
  const durMs = end.getTime() - start.getTime();
  const slots: { startTime: Date; endTime: Date }[] = [];
  const cur = new Date(start);
  while (cur <= until) {
    slots.push({ startTime: new Date(cur), endTime: new Date(cur.getTime() + durMs) });
    cur.setDate(cur.getDate() + 1);
  }
  await prisma.availability.createMany({ data: slots });
  return NextResponse.json({ created: slots.length }, { status: 201 });
}
