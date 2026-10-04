import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, ensureSettings, hashPassword, passwordProblem, validateEmail } from "@/lib/auth";

/** Create a new account. POST { email, password, name? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 100);

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists. Sign in instead." }, { status: 409 });
    }

    const user = await db.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
    });
    await ensureSettings(user.id);
    await db.activity.create({
      data: { userId: user.id, type: "account_created", message: "Account created — welcome aboard" },
    });
    await createSession(user.id);

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create the account" }, { status: 500 });
  }
}
