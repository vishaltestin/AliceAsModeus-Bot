import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, ApiAuthError } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { accountId } = await authenticateApiRequest(req, "contacts:read")
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit")) || 50,
      200
    )
    const contacts = await prisma.contact.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({ data: contacts })
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await authenticateApiRequest(req, "contacts:write")
    const { phone, name, email, company, category } = await req.json()
    if (!phone)
      return NextResponse.json({ error: "phone is required" }, { status: 400 })

    const phoneNormalized = String(phone).replace(/\D/g, "")
    if (category !== undefined) {
      const categoryRow = await prisma.contactCategory.findFirst({
        where: { accountId, name: String(category) },
        select: { id: true },
      })
      if (!categoryRow) {
        return NextResponse.json(
          { error: "Invalid contact category" },
          { status: 400 }
        )
      }
    }
    if (!phoneNormalized)
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      )

    const contact = await prisma.contact.upsert({
      where: { accountId_phoneNormalized: { accountId, phoneNormalized } },
      create: {
        accountId,
        phone,
        phoneNormalized,
        name: name || null,
        email: email || null,
        company: company || null,
        category: category || "LEAD",
      },
      update: {
        name: name || undefined,
        email: email || undefined,
        company: company || undefined,
        category: category || undefined,
      },
    })
    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
