/**
 * Email pipeline: personalization tokens, open/click tracking rewrite,
 * responsive HTML shell, unsubscribe handling, and delivery via SMTP
 * (nodemailer) or simulation mode when SMTP is not configured.
 */
import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

export interface MailConfig {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  smtp: SmtpConfig | null;
}

export function getAppUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function hasSmtp(smtp: SmtpConfig | null | undefined): boolean {
  return Boolean(smtp && smtp.host && smtp.user);
}

/** Replace personalization tokens with contact values. */
export function personalize(html: string, contact: { email: string; firstName?: string; lastName?: string; company?: string }): string {
  const firstName = contact.firstName?.trim() || "there";
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, contact.lastName?.trim() || "")
    .replace(/\{\{\s*full_name\s*\}\}/gi, `${firstName} ${contact.lastName?.trim() || ""}`.trim())
    .replace(/\{\{\s*company\s*\}\}/gi, contact.company?.trim() || "your team")
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email);
}

/** Rewrite <a href> links through the click tracker (skips mailto/tel/hash). */
export function rewriteLinks(html: string, token: string): string {
  return html.replace(/(<a\s[^>]*href=)(["'])([^"']+)(["'])/gi, (m, pre, q, url: string) => {
    if (/^(mailto:|tel:|#|{{)/i.test(url.trim())) return m;
    if (url.includes("/api/track/")) return m;
    const wrapped = `${getAppUrl()}/api/track/click/${token}?url=${encodeURIComponent(url)}`;
    return `${pre}${q}${wrapped}${q}`;
  });
}

/** Append the open-tracking pixel. */
export function appendOpenPixel(html: string, token: string): string {
  const pixel = `<img src="${getAppUrl()}/api/track/open/${token}" width="1" height="1" alt="" style="display:block;border:0;" />`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${pixel}</body>`);
  return html + pixel;
}

/** Ensure an unsubscribe link exists; append a simple footer when missing. */
export function ensureUnsubscribe(html: string, token: string): string {
  if (/\{\{\s*unsubscribe\s*\}\}/i.test(html)) {
    return html.replace(/\{\{\s*unsubscribe\s*\}\}/gi, `${getAppUrl()}/api/track/unsubscribe/${token}`);
  }
  if (/unsubscribe/i.test(html.replace(/<[^>]+>/g, " "))) {
    // link exists but raw — leave as authored
    return html;
  }
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
  <a href="${getAppUrl()}/api/track/unsubscribe/${token}" style="color:#888;">Unsubscribe</a>
</div>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${footer}</body>`);
  return html + footer;
}

/** Wrap a content fragment in a minimal responsive shell if needed. */
export function renderShell(html: string, previewText?: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  const preheader = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;">
${preheader}
<div style="max-width:600px;margin:0 auto;padding:32px 20px;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;">
${html}
</div>
</body>
</html>`;
}

/** Full prepare pipeline for a recipient. */
export function prepareEmail(
  content: string,
  opts: { token: string; contact: { email: string; firstName?: string; lastName?: string; company?: string }; previewText?: string }
): string {
  let html = personalize(content, opts.contact);
  html = ensureUnsubscribe(html, opts.token);
  html = rewriteLinks(html, opts.token);
  html = appendOpenPixel(html, opts.token);
  return renderShell(html, opts.previewText);
}

export async function sendMail(
  config: MailConfig,
  to: { email: string; name?: string },
  subject: string,
  html: string
): Promise<void> {
  if (!hasSmtp(config.smtp)) throw new Error("SMTP is not configured");
  const smtp = config.smtp!;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  await transport.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to: to.name ? `"${to.name}" <${to.email}>` : to.email,
    replyTo: config.replyTo || undefined,
    subject,
    html,
  });
}
