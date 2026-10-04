import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, ensureSettings, validateEmail, verifyPassword } from "@/lib/auth";

/** Sign in. POST { email, password } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!validateEmail(email) || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }

    await ensureSettings(user.id);
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sign in failed" }, { status: 500 });
  }
}
