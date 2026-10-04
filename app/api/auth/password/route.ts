import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";

/** Change password. PUT { currentPassword, newPassword } */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const current = String(body.currentPassword || "");
    const next = String(body.newPassword || "");

    const user = await db.user.findUnique({ where: { id: auth.id } });
    if (!user || !verifyPassword(current, user.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    const problem = passwordProblem(next);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not change password" }, { status: 500 });
  }
}
