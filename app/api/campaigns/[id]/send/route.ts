import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasSmtp, prepareEmail, sendMail, type MailConfig } from "@/lib/mail";
import { ensureSettings, getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const simulate = body.simulate === true;

    const campaign = await db.campaign.findFirst({ where: { id, userId: user.id } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status === "sent") {
      return NextResponse.json({ error: "This campaign was already sent." }, { status: 400 });
    }
    if (!campaign.subject.trim()) {
      return NextResponse.json({ error: "Add a subject line before sending." }, { status: 400 });
    }
    if (!campaign.content.trim() || !campaign.content.replace(/<[^>]+>/g, "").trim()) {
      return NextResponse.json({ error: "Add content before sending." }, { status: 400 });
    }

    const settings = await ensureSettings(user.id);
    const smtp = settings.smtpHost
      ? { host: settings.smtpHost, port: settings.smtpPort, user: settings.smtpUser, pass: settings.smtpPass, secure: settings.smtpSecure }
      : null;
    const live = !simulate && hasSmtp(smtp);

    const contacts = await db.contact.findMany({ where: { userId: user.id, status: "subscribed" } });
    if (contacts.length === 0) {
      return NextResponse.json({ error: "Your audience has no subscribed contacts." }, { status: 400 });
    }

    const config: MailConfig = {
      fromName: campaign.fromName || settings.fromName || "",
      fromEmail: campaign.fromEmail || settings.fromEmail || "",
      replyTo: settings.replyTo || "",
      smtp,
    };

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      const token = `${campaign.id.slice(0, 8)}${contact.id.slice(0, 10)}${Date.now().toString(36)}`;
      const html = prepareEmail(campaign.content, { token, contact, previewText: campaign.previewText });
      if (live) {
        try {
          await sendMail(
            config,
            { email: contact.email, name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") },
            campaign.subject,
            html
          );
        } catch (e) {
          failed++;
          if (errors.length < 3) errors.push(`${contact.email}: ${e instanceof Error ? e.message.slice(0, 120) : "send error"}`);
          continue;
        }
      }
      await db.campaignRecipient.create({
        data: { campaignId: campaign.id, contactId: contact.id, token, status: "sent" },
      });
      sent++;
    }

    const updated = await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "sent", sentAt: new Date() },
    });

    await db.activity.create({
      data: {
        userId: user.id,
        type: "campaign_sent",
        message: `Campaign "${campaign.name}" ${live ? "sent to" : "simulated for"} ${sent} contact${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`,
        meta: campaign.id,
      },
    });

    return NextResponse.json({
      campaign: updated,
      mode: live ? "smtp" : "simulated",
      sent,
      failed,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
