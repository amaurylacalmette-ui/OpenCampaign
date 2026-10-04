import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.template.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["name", "category", "subject", "content"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    const template = await db.template.update({ where: { id }, data });
    return NextResponse.json({ template });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.template.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    await db.template.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete template" }, { status: 500 });
  }
}
