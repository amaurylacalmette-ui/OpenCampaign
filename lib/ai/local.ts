/**
 * Local analysis engine — runs entirely on the server, no API keys required.
 * Heuristics cover subject quality, spam signals, deliverability basics,
 * content structure and calls-to-action.
 */
import type { AiAnalysis, AiFinding, AiInput, Severity } from "./types";

const SPAM_WORDS = [
  "free", "winner", "winning", "cash", "guarantee", "guaranteed", "act now",
  "limited time", "urgent", "buy now", "order now", "100%", "risk-free",
  "no obligation", "click here", "congratulations", "viagra", "lottery",
  "prize", "miracle", "instant", "credit card", "double your", "make money",
  "work from home", "earn $", "extra income", "cancel at any time",
];

const CTA_WORDS = [
  "shop", "start", "get", "join", "try", "download", "register", "book",
  "claim", "reserve", "subscribe", "learn", "discover", "see", "read", "save",
];

const TOKEN = /\{\{\s*(first_name|last_name|email|company)\s*\}\}/i;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function findSpamWords(text: string): string[] {
  const lower = text.toLowerCase();
  return SPAM_WORDS.filter((w) => lower.includes(w));
}

export function analyzeLocally(input: AiInput): AiAnalysis {
  const findings: AiFinding[] = [];
  const subject = (input.subject || "").trim();
  const text = stripHtml(input.content || "");
  const words = text.split(/\s+/).filter(Boolean);
  const linkCount = (input.content.match(/<a\s/gi) || []).length;
  const imgCount = (input.content.match(/<img\s/gi) || []).length;
  const exclaims = (subject.match(/!/g) || []).length;
  const capsWords = (subject.match(/\b[A-Z]{3,}\b/g) || []).length;
  const spamHits = Array.from(
    new Set([...findSpamWords(subject).map((w) => `subject: "${w}"`), ...findSpamWords(text).map((w) => `body: "${w}"`)])
  );

  // --- subject checks ---
  if (!subject) {
    findings.push({ severity: "critical", title: "No subject line", detail: "Emails without a subject rarely get opened and often land in spam. Write one before sending." });
  } else if (subject.length < 15) {
    findings.push({ severity: "warning", title: "Subject is very short", detail: `"${subject}" is ${subject.length} characters. Aim for 20–50 characters so it doesn't get truncated and gives readers a reason to open.` });
  } else if (subject.length > 60) {
    findings.push({ severity: "info", title: "Subject may get truncated", detail: `At ${subject.length} characters, mobile clients will cut this off around 35–45. Put the hook up front.` });
  } else {
    findings.push({ severity: "good", title: "Subject length is in the sweet spot", detail: `${subject.length} characters — long enough to sell the open, short enough to survive mobile.` });
  }

  if (exclaims >= 2) {
    findings.push({ severity: "warning", title: "Multiple exclamation marks in subject", detail: `${exclaims} exclamation marks read as promotional. One maximum, or none.` });
  }
  if (capsWords.length > 0) {
    findings.push({ severity: "warning", title: "ALL-CAPS words in subject", detail: `${capsWords.join(", ")} — caps trigger spam filters and read as shouting. Use emphasis sparingly instead.` });
  }
  if (subject && TOKEN.test(subject)) {
    findings.push({ severity: "good", title: "Personalization token in subject", detail: "Personalized subject lines typically lift open rates. Double-check your fallback text for contacts missing that field." });
  }

  // --- body checks ---
  if (words.length === 0) {
    findings.push({ severity: "critical", title: "Email has no text content", detail: "The body is empty or image-only. Write some copy before sending." });
  } else if (words.length < 40) {
    findings.push({ severity: "info", title: "Body copy is very short", detail: `${words.length} words. Short can work — just make sure the single idea and one clear link are there.` });
  } else if (words.length > 900) {
    findings.push({ severity: "info", title: "Body copy is long", detail: `${words.length} words. Consider trimming or splitting into a series; engagement usually drops after ~300 words.` });
  } else {
    findings.push({ severity: "good", title: "Body length is healthy", detail: `${words.length} words — enough to deliver value without losing the reader.` });
  }

  if (imgCount > 0 && words.length < 25 * imgCount) {
    findings.push({ severity: "warning", title: "Image-heavy email", detail: `${imgCount} image(s) vs ${words.length} words. Many clients block images by default; a near image-only email can render blank. Balance with real text.` });
  }
  if (linkCount === 0) {
    findings.push({ severity: "warning", title: "No links", detail: "There is nothing to click. Add at least one link matching your call to action." });
  } else if (linkCount > 12) {
    findings.push({ severity: "warning", title: "A lot of links", detail: `${linkCount} links dilute attention and can look spammy. Keep the 1–3 that matter.` });
  } else {
    findings.push({ severity: "good", title: "Link count is reasonable", detail: `${linkCount} link(s) — focused and easy to act on.` });
  }

  if (spamHits.length > 0) {
    findings.push({ severity: spamHits.length > 3 ? "critical" : "warning", title: "Possible spam trigger words", detail: `Found: ${spamHits.slice(0, 8).join(", ")}. These don't guarantee the spam folder, but stacked together they raise risk. Reword where you can.` });
  }
  if (!/{{\s*unsubscribe\s*}}/i.test(input.content) && !/unsubscribe/i.test(stripHtml(input.content))) {
    findings.push({ severity: "critical", title: "No unsubscribe link", detail: "Marketing email legally requires an opt-out (CAN-SPAM, GDPR). Add the {{unsubscribe}} token — OpenCampaign also appends one automatically at send time if missing." });
  } else {
    findings.push({ severity: "good", title: "Unsubscribe option present", detail: "Good — compliant and respectful of the reader." });
  }

  const ctaWord = CTA_WORDS.find((w) => new RegExp(`\\b${w}`, "i").test(stripHtml(input.content.match(/<a\s[\s\S]*?<\/a>/gi)?.join(" ") || text)));
  if (ctaWord || linkCount > 0) {
    findings.push({ severity: "good", title: "Call to action present", detail: ctaWord ? `Action verb "${ctaWord}" found near a link.` : "Link present — make sure the surrounding text tells readers exactly what to do." });
  } else {
    findings.push({ severity: "warning", title: "Weak call to action", detail: "No clear action verb. Tell readers precisely what to do next: read, start, register, reply." });
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3);
  const avgLen = sentences.length ? words.length / sentences.length : words.length;
  if (avgLen > 28) {
    findings.push({ severity: "info", title: "Sentences run long", detail: `Average sentence is ${Math.round(avgLen)} words. Break a few up — shorter sentences scan better on phones.` });
  }

  const hasPersonalization = TOKEN.test(input.content);
  if (!hasPersonalization && words.length > 0) {
    findings.push({ severity: "info", title: "No personalization in body", detail: 'A {{first_name}} at the top is a cheap way to make the email feel written, not blasted.' });
  }

  // --- score ---
  const weights: Record<Severity, number> = { critical: 22, warning: 9, info: 3, good: 0 };
  let penalty = 0;
  for (const f of findings) {
    if (f.severity !== "good") penalty += weights[f.severity];
  }
  const score = Math.max(8, Math.min(100, 100 - penalty));

  const strengths = findings.filter((f) => f.severity === "good").map((f) => `${f.title} — ${f.detail}`);
  const issues = findings
    .filter((f) => f.severity === "warning" || f.severity === "critical")
    .map((f) => `${f.title} — ${f.detail}`);
  const notes = findings.filter((f) => f.severity === "info").map((f) => `${f.title} — ${f.detail}`);

  const suggestions: string[] = [];
  if (!subject || subject.length < 15) suggestions.push("Write a 20–50 character subject that names the one thing readers get from opening.");
  if (subject.length > 60) suggestions.push("Move the key words of your subject to the front; trim the tail.");
  if (exclaims >= 2 || capsWords.length) suggestions.push("Drop the exclamation marks and caps — confidence reads better than volume.");
  if (spamHits.length) suggestions.push("Replace spammy phrases with plain, specific language (e.g. \"free ebook\" → \"the checklist we use\").");
  if (linkCount === 0) suggestions.push("Add one clear button link with an action verb: Start, Read, Register, Get.");
  if (linkCount > 12) suggestions.push("Cut the link list down to the one or two actions that actually matter.");
  if (imgCount > 0 && words.length < 25 * imgCount) suggestions.push("Add a text summary so the email still works with images blocked.");
  if (!hasPersonalization) suggestions.push('Open with {{first_name}} — it takes ten seconds and lifts engagement.');
  if (!/{{\s*unsubscribe\s*}}/i.test(input.content) && !/unsubscribe/i.test(stripHtml(input.content))) suggestions.push("Add {{unsubscribe}} in the footer.");
  if (avgLen > 28) suggestions.push("Split long sentences; aim for a 15–20 word average.");
  if (suggestions.length === 0) suggestions.push("This email is in good shape. A/B test the subject line to squeeze out more opens.");

  const subjectIdeas = subject ? generateSubjectIdeas(subject) : [];
  const summary =
    `Scored ${score}/100. ` +
    (score >= 80
      ? "This is a strong, deliverable-friendly email. "
      : score >= 55
      ? "Solid base with a few fixable issues. "
      : "Needs work before sending — see the issues below. ") +
    `${words.length} words, ${linkCount} link(s), subject ${subject ? `${subject.length} chars` : "missing"}.` +
    (notes.length ? ` Also worth noting: ${notes[0]}` : "");

  return {
    provider: "local",
    score,
    summary,
    strengths,
    issues,
    suggestions,
    subjectIdeas,
    checkedAt: new Date().toISOString(),
  };
}

function generateSubjectIdeas(subject: string): string[] {
  const clean = subject.replace(/!+/g, "").replace(/\s+/g, " ").trim();
  const base = clean.replace(/^(the|a|an)\s+/i, "");
  const ideas = [
    base.charAt(0).toLowerCase() + base.slice(1) + " (quick one)",
    `Inside: ${base}`,
    `${base} — worth 2 minutes?`,
  ];
  return Array.from(new Set(ideas)).slice(0, 3);
}
