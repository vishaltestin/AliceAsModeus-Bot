import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resumePendingExecution } from "@/lib/automations/engine"

export async function GET(req: NextRequest) {
  const secret = process.env.AUTOMATION_CRON_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    return new NextResponse("Cron secret is not configured", { status: 503 })
  }
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      new URL(req.url).searchParams.get("secret")
    if (!provided || provided !== secret)
      return new NextResponse("Forbidden", { status: 403 })
  }

  const due = await prisma.automationPendingExecution.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    take: 50,
  })
  for (const pending of due) await resumePendingExecution(pending.id)

  return NextResponse.json({ processed: due.length })
}
