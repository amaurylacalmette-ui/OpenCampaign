import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("url") || "";
  try {
    const recipient = await db.campaignRecipient.findUnique({ where: { token } });
    if (recipient) {
      await db.campaignRecipient.update({
        where: { token },
        data: { clickCount: { increment: 1 }, lastClicked: new Date() },
      });
    }
  } catch {
    // never block the redirect
  }
  let safeTarget: string | null = null;
  if (target) {
    try {
      const parsed = new URL(target);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") safeTarget = parsed.toString();
    } catch {
      safeTarget = null;
    }
  }
  if (!safeTarget) {
    return NextResponse.redirect(new URL("/", url.origin), 302);
  }
  return NextResponse.redirect(safeTarget, 302);
}
