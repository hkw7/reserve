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
    const availability = await prisma.availability.create({ data: { startTime: start, endTime: end } });
    return NextResponse.json(availability, { status: 201 });
  }

  const until = new Date(repeatUntil);
  until.setHours(23, 59, 59, 999);
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
