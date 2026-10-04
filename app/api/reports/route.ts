import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      where: { userId: user.id, status: "sent" },
      orderBy: { sentAt: "desc" },
      include: { recipients: { include: { contact: { select: { email: true } } } } },
    });

    const perCampaign = campaigns.map((c) => {
      const rs = c.recipients;
      const opens = rs.filter((r) => r.openCount > 0);
      const clicks = rs.filter((r) => r.clickCount > 0);
      return {
        id: c.id,
        name: c.name,
        subject: c.subject,
        sentAt: c.sentAt,
        recipients: rs.length,
        opens: opens.length,
        clicks: clicks.length,
        openRate: rs.length ? Math.round((opens.length / rs.length) * 1000) / 10 : 0,
        clickRate: rs.length ? Math.round((clicks.length / rs.length) * 1000) / 10 : 0,
        totalOpens: rs.reduce((n, r) => n + r.openCount, 0),
        totalClicks: rs.reduce((n, r) => n + r.clickCount, 0),
      };
    });

    // opens/clicks per day over the last 30 days
    const days: { date: string; opens: number; clicks: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), opens: 0, clicks: 0 });
    }
    const recipients = await db.campaignRecipient.findMany({
      where: { campaign: { userId: user.id }, OR: [{ lastOpened: { not: null } }, { lastClicked: { not: null } }] },
      select: { lastOpened: true, lastClicked: true, openCount: true, clickCount: true },
    });
    for (const r of recipients) {
      if (r.lastOpened) {
        const key = r.lastOpened.toISOString().slice(0, 10);
        const day = days.find((x) => x.date === key);
        if (day) day.opens += 1;
      }
      if (r.lastClicked) {
        const key = r.lastClicked.toISOString().slice(0, 10);
        const day = days.find((x) => x.date === key);
        if (day) day.clicks += 1;
      }
    }

    const totals = perCampaign.reduce(
      (acc, c) => ({
        recipients: acc.recipients + c.recipients,
        opens: acc.opens + c.opens,
        clicks: acc.clicks + c.clicks,
      }),
      { recipients: 0, opens: 0, clicks: 0 }
    );

    return NextResponse.json({
      perCampaign,
      timeline: days,
      totals: {
        ...totals,
        openRate: totals.recipients ? Math.round((totals.opens / totals.recipients) * 1000) / 10 : 0,
        clickRate: totals.recipients ? Math.round((totals.clicks / totals.recipients) * 1000) / 10 : 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to build reports" }, { status: 500 });
  }
}
