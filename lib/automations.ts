/**
 * Automation engine: enqueues jobs when contacts enter the audience and
 * processes due jobs (welcome emails, tag-triggered drips).
 * Processing is idempotent and safe to call repeatedly (client heartbeat
 * or external cron hitting /api/automations/process).
 * Automations and SMTP settings are scoped per account.
 */
import { db } from "@/lib/db";
import { hasSmtp, prepareEmail, sendMail } from "@/lib/mail";
import type { MailConfig } from "@/lib/mail";

export async function enqueueForContact(contact: { id: string; userId: string; email: string; tags: string }) {
  const automations = await db.automation.findMany({ where: { userId: contact.userId, status: "active" } });
  const contactTags = contact.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const matches = automations.filter((a) => {
    if (a.trigger === "signup") return true;
    if (a.trigger === "tag") {
      const tag = a.triggerTag.trim().toLowerCase();
      return tag && contactTags.includes(tag);
    }
    return false;
  });
  if (matches.length === 0) return 0;
  await db.automationJob.createMany({
    data: matches.map((a) => ({
      automationId: a.id,
      contactId: contact.id,
      dueAt: new Date(Date.now() + Math.max(0, a.delayHours) * 3600 * 1000),
    })),
  });
  return matches.length;
}

interface SmtpLike {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

function smtpFromSettings(settings: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
} | null): SmtpLike | null {
  return settings?.smtpHost
    ? { host: settings.smtpHost, port: settings.smtpPort, user: settings.smtpUser, pass: settings.smtpPass, secure: settings.smtpSecure }
    : null;
}

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  mode: "smtp" | "simulated";
}

export async function processDueJobs(): Promise<ProcessResult> {
  const jobs = await db.automationJob.findMany({
    where: { status: "queued", dueAt: { lte: new Date() } },
    include: { automation: true, contact: true },
    take: 50,
  });

  // per-account settings cache (SMTP + sender defaults live on the account)
  const settingsCache = new Map<string, Awaited<ReturnType<typeof db.settings.findUnique>>>();

  let sent = 0;
  let failed = 0;
  let lastMode: "smtp" | "simulated" = "simulated";

  for (const job of jobs) {
    const { automation, contact } = job;
    if (automation.status !== "active" || contact.status !== "subscribed") {
      await db.automationJob.update({ where: { id: job.id }, data: { status: "failed", error: "Automation paused or contact no longer subscribed" } });
      failed++;
      continue;
    }

    if (!settingsCache.has(automation.userId)) {
      settingsCache.set(automation.userId, await db.settings.findUnique({ where: { userId: automation.userId } }));
    }
    const settings = settingsCache.get(automation.userId) ?? null;
    const smtp = smtpFromSettings(settings);
    const mode: "smtp" | "simulated" = hasSmtp(smtp) ? "smtp" : "simulated";
    lastMode = mode;

    const config: MailConfig = {
      fromName: automation.fromName || settings?.fromName || "",
      fromEmail: automation.fromEmail || settings?.fromEmail || "",
      replyTo: settings?.replyTo || "",
      smtp,
    };
    const html = prepareEmail(automation.content, {
      token: job.id,
      contact,
      previewText: "",
    });
    const subject = automation.subject
      .replace(/\{\{\s*first_name\s*\}\}/gi, contact.firstName || "there")
      .replace(/\{\{\s*last_name\s*\}\}/gi, contact.lastName || "");

    if (mode === "smtp") {
      try {
        await sendMail(config, { email: contact.email, name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") }, subject, html);
      } catch (e) {
        await db.automationJob.update({ where: { id: job.id }, data: { status: "failed", error: e instanceof Error ? e.message.slice(0, 400) : "send error" } });
        failed++;
        continue;
      }
    }
    await db.automationJob.update({ where: { id: job.id }, data: { status: "sent", sentAt: new Date() } });
    await db.automation.update({ where: { id: automation.id }, data: { sentCount: { increment: 1 } } });
    await db.activity.create({
      data: {
        userId: automation.userId,
        type: "automation_sent",
        message: `Automation "${automation.name}" ${mode === "smtp" ? "sent to" : "simulated for"} ${contact.email}`,
        meta: JSON.stringify({ automationId: automation.id, contactId: contact.id, mode }),
      },
    });
    sent++;
  }

  return { processed: jobs.length, sent, failed, mode: lastMode };
}
