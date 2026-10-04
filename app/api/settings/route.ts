import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSettings, getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await ensureSettings(user.id);
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["fromName", "fromEmail", "replyTo", "smtpHost", "smtpUser", "smtpPass", "aiProvider", "openrouterKey", "openaiKey", "publikhqUrl", "publikhqKey"] as const) {
      if (typeof body[key] === "string") data[key] = body[key];
    }
    if (body.smtpPort !== undefined) data.smtpPort = Math.max(1, parseInt(String(body.smtpPort), 10) || 587);
    if (typeof body.smtpSecure === "boolean") data.smtpSecure = body.smtpSecure;
    if (typeof body.doubleOptIn === "boolean") data.doubleOptIn = body.doubleOptIn;
    if (["local", "openrouter", "openai", "publikhq"].includes(body.aiProvider)) data.aiProvider = body.aiProvider;

    await ensureSettings(user.id);
    const settings = await db.settings.update({ where: { userId: user.id }, data });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to save settings" }, { status: 500 });
  }
}
