/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { advanceDueJobs } from "@/services/workflow/worker";

// Vercel sends `x-vercel-cron: 1` for jobs defined in vercel.json `crons`.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Cron only" } }, { status: 401 });
  }

  try {
    const result = await advanceDueJobs({ limit: 10 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] advanceDueJobs failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Worker run failed" } },
      { status: 500 }
    );
  }
}