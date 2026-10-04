import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const contacts = await db.contact.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const csv = toCsv(
    contacts.map((c) => ({
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      company: c.company,
      status: c.status,
      tags: c.tags,
      created_at: c.createdAt.toISOString(),
    })),
    ["email", "first_name", "last_name", "company", "status", "tags", "created_at"]
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="opencampaign-audience-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
