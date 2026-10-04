import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueForContact } from "@/lib/automations";
import { getAuthUser } from "@/lib/auth";

const STATUSES = ["subscribed", "pending", "unsubscribed", "cleaned"];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status") || "";
    const tag = searchParams.get("tag") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "20", 10) || 20));

    const where: Record<string, unknown> = { userId: user.id };
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { company: { contains: q } },
      ];
    }
    if (status && STATUSES.includes(status)) where.status = status;
    if (tag) where.tags = { contains: tag };

    const [total, contacts] = await Promise.all([
      db.contact.count({ where }),
      db.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // all tags for the filter chips
    const all = await db.contact.findMany({ where: { userId: user.id }, select: { tags: true } });
    const tagSet = new Set<string>();
    for (const c of all) c.tags.split(",").forEach((t) => t.trim() && tagSet.add(t.trim()));

    return NextResponse.json({
      contacts,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      tags: Array.from(tagSet).sort(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    const existing = await db.contact.findUnique({ where: { userId_email: { userId: user.id, email } } });
    if (existing) {
      return NextResponse.json({ error: "That email is already in your audience." }, { status: 409 });
    }
    const contact = await db.contact.create({
      data: {
        userId: user.id,
        email,
        firstName: String(body.firstName || "").trim(),
        lastName: String(body.lastName || "").trim(),
        company: String(body.company || "").trim(),
        status: STATUSES.includes(body.status) ? body.status : "subscribed",
        tags: String(body.tags || "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
          .join(","),
      },
    });
    await db.activity.create({
      data: { userId: user.id, type: "contact_added", message: `Added ${contact.email} to the audience`, meta: contact.id },
    });
    await enqueueForContact(contact);
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to create contact" }, { status: 500 });
  }
}
