import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/automations";

async function handle() {
  try {
    const result = await processDueJobs();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Processing failed" }, { status: 500 });
  }
}

export async function POST() {
  return handle();
}

export async function GET() {
  // cron-friendly
  return handle();
}
