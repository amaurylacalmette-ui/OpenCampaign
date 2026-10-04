import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAnalysis } from "@/lib/ai";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const campaign = await db.campaign.findFirst({ where: { id, userId: user.id } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!campaign.content.trim() && !campaign.subject.trim()) {
      return NextResponse.json({ error: "Add a subject and some content before analyzing." }, { status: 400 });
    }

    const analysis = await runAnalysis(
      {
        name: campaign.name,
        subject: campaign.subject,
        previewText: campaign.previewText,
        content: campaign.content,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
      },
      typeof body.provider === "string" && body.provider ? body.provider : undefined,
      user.id
    );

    await db.campaign.update({ where: { id }, data: { analysis: JSON.stringify(analysis) } });
    await db.activity.create({
      data: {
        userId: user.id,
        type: "ai_analysis",
        message: `AI analyzed "${campaign.name}" via ${analysis.provider}${analysis.model ? ` (${analysis.model})` : ""} — score ${analysis.score}/100`,
        meta: campaign.id,
      },
    });

    return NextResponse.json({ analysis });
  } catch (e) {
    const status = e instanceof Error && e.name === "AiProviderError" ? 400 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status });
  }
}
