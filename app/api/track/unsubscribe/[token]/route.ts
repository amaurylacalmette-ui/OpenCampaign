import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

function page(title: string, body: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; background:#f4f4f2; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#222; }
  .card { max-width:460px; margin:12vh auto 0; background:#fff; border-radius:16px; padding:40px 36px; box-shadow:0 8px 30px rgba(0,0,0,.06); text-align:center; }
  h1 { font-size:22px; margin:0 0 10px; }
  p { color:#666; line-height:1.6; margin:0 0 18px; font-size:15px; }
  .mark { width:44px; height:44px; border-radius:12px; background:#111; color:#ffd83d; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; margin-bottom:18px; }
  a { color:#111; font-weight:600; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">O</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const recipient = await db.campaignRecipient.findUnique({ where: { token }, include: { contact: true, campaign: true } });
    if (!recipient) {
      return page("Link expired", "This unsubscribe link is no longer valid. If you keep getting email from us, reply and we'll take care of it.");
    }
    if (recipient.contact.status !== "unsubscribed") {
      await db.contact.update({ where: { id: recipient.contactId }, data: { status: "unsubscribed" } });
      await db.activity.create({
        data: {
          userId: recipient.campaign.userId,
          type: "contact_unsubscribed",
          message: `${recipient.contact.email} unsubscribed`,
          meta: recipient.contactId,
        },
      });
    }
    return page("You're unsubscribed", `${recipient.contact.email} won't receive any more campaigns. Changed your mind? You can always re-subscribe from the website.`);
  } catch {
    return page("Something went wrong", "We couldn't process that request. Please try again in a moment.");
  }
}
