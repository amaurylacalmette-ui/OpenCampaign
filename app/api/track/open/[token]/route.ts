import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const recipient = await db.campaignRecipient.findUnique({ where: { token } });
    if (recipient) {
      await db.campaignRecipient.update({
        where: { token },
        data: { openCount: { increment: 1 }, lastOpened: new Date() },
      });
    }
  } catch {
    // never block the pixel
  }
  return new NextResponse(new Uint8Array(PIXEL), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
