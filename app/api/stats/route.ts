import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const [contactsByStatus, campaigns, openAgg, activity, recentCampaigns] = await Promise.all([
      db.contact.groupBy({ by: ["status"], _count: { _all: true }, where: { userId: user.id } }),
      db.campaign.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { recipients: true } }),
      db.campaignRecipient.aggregate({ _sum: { openCount: true, clickCount: true }, where: { campaign: { userId: user.id } } }),
      db.activity.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.campaign.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, subject: true, status: true, sentAt: true, recipients: { select: { openCount: true, clickCount: true } } } }),
    ]);

    const statusCounts: Record<string, number> = {};
    let totalContacts = 0;
    for (const g of contactsByStatus) {
      statusCounts[g.status] = g._count._all;
      totalContacts += g._count._all;
    }

    const sentCampaigns = campaigns.filter((c) => c.status === "sent");
    const totalRecipients = sentCampaigns.reduce((n, c) => n + c.recipients.length, 0);
    const uniqueOpens = sentCampaigns.reduce((n, c) => n + c.recipients.filter((r) => r.openCount > 0).length, 0);
    const uniqueClicks = sentCampaigns.reduce((n, c) => n + c.recipients.filter((r) => r.clickCount > 0).length, 0);

    const stats = {
      totalContacts,
      subscribed: statusCounts["subscribed"] || 0,
      pending: statusCounts["pending"] || 0,
      unsubscribed: statusCounts["unsubscribed"] || 0,
      cleaned: statusCounts["cleaned"] || 0,
      campaignsSent: sentCampaigns.length,
      drafts: campaigns.filter((c) => c.status === "draft").length,
      totalRecipients,
      openRate: totalRecipients ? Math.round((uniqueOpens / totalRecipients) * 1000) / 10 : 0,
      clickRate: totalRecipients ? Math.round((uniqueClicks / totalRecipients) * 1000) / 10 : 0,
      totalOpens: openAgg._sum.openCount || 0,
      totalClicks: openAgg._sum.clickCount || 0,
      automationsActive: await db.automation.count({ where: { userId: user.id, status: "active" } }),
    };

    return NextResponse.json({
      stats,
      activity,
      recentCampaigns: recentCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        sentAt: c.sentAt,
        recipients: c.recipients.length,
        opens: c.recipients.filter((r) => r.openCount > 0).length,
        clicks: c.recipients.filter((r) => r.clickCount > 0).length,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load stats" }, { status: 500 });
  }
}
