import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.automation.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Automation not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["name", "subject", "content", "triggerTag"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (["active", "paused"].includes(body.status)) data.status = body.status;
    if (["signup", "tag"].includes(body.trigger)) data.trigger = body.trigger;
    if (body.delayHours !== undefined) data.delayHours = Math.max(0, parseInt(String(body.delayHours), 10) || 0);
    const automation = await db.automation.update({ where: { id }, data });
    return NextResponse.json({ automation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update automation" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.automation.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    await db.automation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete automation" }, { status: 500 });
  }
}
