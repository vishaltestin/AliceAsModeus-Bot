import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, ApiAuthError } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { accountId } = await authenticateApiRequest(
      req,
      "conversations:read"
    )
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit")) || 50,
      200
    )
    const conversations = await prisma.conversation.findMany({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { contact: { select: { id: true, name: true, phone: true } } },
    })
    return NextResponse.json({ data: conversations })
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
