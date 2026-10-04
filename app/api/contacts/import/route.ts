import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { enqueueForContact } from "@/lib/automations";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { csv } = await req.json();
    if (typeof csv !== "string" || csv.trim().length === 0) {
      return NextResponse.json({ error: "Paste CSV content or upload a file." }, { status: 400 });
    }
    const rows = parseCsv(csv);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const email = (row.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped++;
        continue;
      }
      const tags = (row.tags || "")
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .join(",");
      const data = {
        firstName: row.first_name || row.firstname || "",
        lastName: row.last_name || row.lastname || "",
        company: row.company || "",
        status: ["subscribed", "pending", "unsubscribed", "cleaned"].includes(row.status) ? row.status : "subscribed",
        tags,
      };
      const existing = await db.contact.findUnique({ where: { userId_email: { userId: user.id, email } } });
      if (existing) {
        await db.contact.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        const contact = await db.contact.create({ data: { userId: user.id, email, ...data } });
        await enqueueForContact(contact);
        created++;
      }
    }

    await db.activity.create({
      data: {
        userId: user.id,
        type: "contact_imported",
        message: `Imported contacts — ${created} added, ${updated} updated, ${skipped} skipped`,
      },
    });

    return NextResponse.json({ created, updated, skipped, errors });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 500 });
  }
}
