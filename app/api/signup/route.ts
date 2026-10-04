import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueForContact } from "@/lib/automations";

/**
 * Public signup endpoint — powers the embeddable signup form.
 * POST { email, firstName?, lastName?, tags?, account?, hp? }
 * `account` identifies whose audience the signup belongs to (included in the
 * embed snippet). hp = honeypot, must stay empty.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // honeypot: bots fill hidden fields, humans don't
    if (typeof body.hp === "string" && body.hp.length > 0) {
      return NextResponse.json({ ok: true }); // silently swallow
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const account = String(body.account || "").trim();
    const owner = account ? await db.user.findUnique({ where: { id: account } }) : null;
    if (!owner) {
      return NextResponse.json({ error: "This signup form is not linked to a valid account." }, { status: 400 });
    }

    const settings = await db.settings.findUnique({ where: { userId: owner.id } });
    const status = settings?.doubleOptIn ? "pending" : "subscribed";

    let contact = await db.contact.findUnique({ where: { userId_email: { userId: owner.id, email } } });
    if (contact && contact.status === "subscribed") {
      return NextResponse.json({ ok: true, message: "You're already on the list." });
    }
    if (contact) {
      contact = await db.contact.update({ where: { id: contact.id }, data: { status } });
    } else {
      contact = await db.contact.create({
        data: {
          userId: owner.id,
          email,
          firstName: String(body.firstName || "").trim(),
          lastName: String(body.lastName || "").trim(),
          status,
          tags: String(body.tags || "")
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
            .join(","),
        },
      });
    }

    if (status === "subscribed") {
      await enqueueForContact(contact);
    }
    await db.activity.create({
      data: { userId: owner.id, type: "contact_added", message: `${email} joined via signup form`, meta: contact.id },
    });

    return NextResponse.json({
      ok: true,
      message:
        status === "pending"
          ? "Almost there — check your inbox to confirm."
          : "You're on the list. Welcome!",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Signup failed" }, { status: 500 });
  }
}
