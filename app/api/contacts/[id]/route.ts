import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.contact.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
    if (typeof body.firstName === "string") data.firstName = body.firstName.trim();
    if (typeof body.lastName === "string") data.lastName = body.lastName.trim();
    if (typeof body.company === "string") data.company = body.company.trim();
    if (typeof body.status === "string" && ["subscribed", "pending", "unsubscribed", "cleaned"].includes(body.status)) data.status = body.status;
    if (typeof body.tags === "string") {
      data.tags = body.tags.split(",").map((t: string) => t.trim()).filter(Boolean).join(",");
    }
    const contact = await db.contact.update({ where: { id }, data });
    return NextResponse.json({ contact });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await db.contact.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    await db.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete contact" }, { status: 500 });
  }
}
