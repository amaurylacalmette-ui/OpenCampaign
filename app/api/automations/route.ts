import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processDueJobs } from "@/lib/automations";
import { ensureSettings, getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const automations = await db.automation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { jobs: { where: { status: "queued" }, select: { id: true } } },
    });
    return NextResponse.json({
      automations: automations.map((a) => ({ ...a, queued: a.jobs.length, jobs: undefined })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load automations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    if (!String(body.name || "").trim()) return NextResponse.json({ error: "Give the automation a name." }, { status: 400 });
    if (!String(body.subject || "").trim()) return NextResponse.json({ error: "A subject line is required." }, { status: 400 });
    if (!String(body.content || "").trim()) return NextResponse.json({ error: "Email content is required." }, { status: 400 });
    const settings = await ensureSettings(user.id);
    const automation = await db.automation.create({
      data: {
        userId: user.id,
        name: String(body.name).slice(0, 200),
        trigger: ["signup", "tag"].includes(body.trigger) ? body.trigger : "signup",
        triggerTag: String(body.triggerTag || "").trim(),
        delayHours: Math.max(0, parseInt(String(body.delayHours ?? 0), 10) || 0),
        subject: String(body.subject),
        fromName: String(body.fromName ?? settings.fromName ?? ""),
        fromEmail: String(body.fromEmail ?? settings.fromEmail ?? ""),
        content: String(body.content),
        status: "active",
      },
    });
    await db.activity.create({
      data: { userId: user.id, type: "automation_created", message: `Automation "${automation.name}" activated`, meta: automation.id },
    });
    return NextResponse.json({ automation }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to create automation" }, { status: 500 });
  }
}

// convenience: process due jobs from the same resource (also available at /api/automations/process)
export async function PUT() {
  const result = await processDueJobs();
  return NextResponse.json(result);
}
