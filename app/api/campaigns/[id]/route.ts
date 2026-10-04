import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const campaign = await db.campaign.findFirst({
      where: { id, userId: user.id },
      include: { recipients: { include: { contact: { select: { email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } } },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load campaign" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const existing = await db.campaign.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    for (const key of ["name", "subject", "previewText", "fromName", "fromEmail", "content"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (typeof body.analysis === "string" || body.analysis === null) data.analysis = body.analysis;
    const campaign = await db.campaign.update({ where: { id }, data });
    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.campaign.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    await db.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete campaign" }, { status: 500 });
  }
}
