import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAnalysis, pickFreeModel, AiProviderError } from "@/lib/ai";
import { ensureSettings, getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const provider = String(body.provider || "local");

    if (provider === "openrouter") {
      const key = String(body.openrouterKey || "").trim();
      if (!key) return NextResponse.json({ error: "Enter your OpenRouter API key first." }, { status: 400 });
      const model = await pickFreeModel(key);
      return NextResponse.json({ ok: true, provider, model, message: `Connected. Free model selected automatically: ${model}` });
    }

    if (provider === "openai") {
      const key = String(body.openaiKey || "").trim();
      if (!key) return NextResponse.json({ error: "Enter your OpenAI API key first." }, { status: 400 });
      await ensureSettings(user.id);
      await db.settings.update({ where: { userId: user.id }, data: { openaiKey: key } });
      const analysis = await runAnalysis(SAMPLE, "openai", user.id);
      return NextResponse.json({ ok: true, provider, model: analysis.model, message: `Connected. ${analysis.model} responded with score ${analysis.score}/100.` });
    }

    if (provider === "publikhq") {
      const url = String(body.publikhqUrl || "").trim();
      const key = String(body.publikhqKey || "").trim();
      await ensureSettings(user.id);
      await db.settings.update({ where: { userId: user.id }, data: { publikhqUrl: url, publikhqKey: key } });
      const analysis = await runAnalysis(SAMPLE, "publikhq", user.id);
      return NextResponse.json({ ok: true, provider, model: analysis.model, message: `Connected to PublikHQ. ${analysis.model} responded with score ${analysis.score}/100.` });
    }

    // local
    const analysis = await runAnalysis(SAMPLE, "local", user.id);
    return NextResponse.json({ ok: true, provider: "local", model: "built-in heuristics", message: `Local engine ready. Sample score: ${analysis.score}/100.` });
  } catch (e) {
    const status = e instanceof AiProviderError ? 400 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Test failed" }, { status });
  }
}

const SAMPLE = {
  name: "Connection test",
  subject: "Your monthly roundup",
  previewText: "Three things worth two minutes.",
  content:
    "<h1>Hey {{first_name}},</h1><p>Here is what changed this month and why it matters for your team. Short version: everything got faster and the reports view finally makes sense.</p><p><a href=\"https://example.com\">Read the full update</a></p><p>— The team</p>",
  fromName: "Test Sender",
  fromEmail: "test@example.com",
};
