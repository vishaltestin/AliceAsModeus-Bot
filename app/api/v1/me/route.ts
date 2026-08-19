import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, ApiAuthError } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { accountId, scopes } = await authenticateApiRequest(req)
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, name: true },
    })
    return NextResponse.json({ account, scopes })
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
