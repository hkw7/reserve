import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const availability = await prisma.availability.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true } } },
  });

  if (!availability) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (availability._count.bookings > 0)
    return NextResponse.json({ error: "既に予約があるため削除できません" }, { status: 400 });

  await prisma.availability.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
