import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSettings, getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { recipients: { select: { status: true, openCount: true, clickCount: true } } },
    });
    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        previewText: c.previewText,
        fromName: c.fromName,
        fromEmail: c.fromEmail,
        status: c.status,
        sentAt: c.sentAt,
        createdAt: c.createdAt,
        recipients: c.recipients.length,
        opens: c.recipients.filter((r) => r.openCount > 0).length,
        clicks: c.recipients.filter((r) => r.clickCount > 0).length,
        hasAnalysis: Boolean(c.analysis),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load campaigns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const settings = await ensureSettings(user.id);
    const campaign = await db.campaign.create({
      data: {
        userId: user.id,
        name: String(body.name || "Untitled campaign").slice(0, 200),
        subject: String(body.subject || ""),
        previewText: String(body.previewText || ""),
        fromName: String(body.fromName ?? settings.fromName ?? ""),
        fromEmail: String(body.fromEmail ?? settings.fromEmail ?? ""),
        content: String(body.content || ""),
        status: "draft",
      },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to create campaign" }, { status: 500 });
  }
}
