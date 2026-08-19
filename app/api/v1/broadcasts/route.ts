import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, ApiAuthError } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { sendTemplateMessage } from "@/lib/whatsapp/client"
import { extractVariables } from "@/lib/whatsapp/templates"
import { consumeMessages, QuotaError } from "@/lib/quota"

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await authenticateApiRequest(req, "broadcasts:send")
    const { templateName, language, phones, variables } = await req.json()
    if (!templateName || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: "templateName and a non-empty phones array are required" },
        { status: 400 }
      )
    }
    if (phones.length > 1000) {
      return NextResponse.json(
        { error: "A single broadcast can contain at most 1,000 phones" },
        { status: 400 }
      )
    }

    const template = await prisma.messageTemplate.findFirst({
      where: {
        accountId,
        name: templateName,
        language: language || "en_US",
        status: "APPROVED",
      },
    })
    if (!template)
      return NextResponse.json(
        { error: "Approved template not found" },
        { status: 404 }
      )

    const requiredVariableCount = extractVariables(template.bodyText).length
    if (requiredVariableCount > 0) {
      if (
        !Array.isArray(variables) ||
        variables.length !== phones.length ||
        !variables.every((row: unknown) => Array.isArray(row))
      ) {
        return NextResponse.json(
          {
            error: `This template requires variables for all ${phones.length} recipients. Send variables as a two-dimensional array.`,
          },
          { status: 400 }
        )
      }
      if (
        variables.some((row: unknown[]) => row.length < requiredVariableCount)
      ) {
        return NextResponse.json(
          {
            error: `Each recipient needs at least ${requiredVariableCount} template variables.`,
          },
          { status: 400 }
        )
      }
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { accountId },
    })
    if (!config || config.status !== "CONNECTED")
      return NextResponse.json(
        { error: "WhatsApp is not connected" },
        { status: 409 }
      )

    // Reserve one message per recipient against the account's quota.
    try {
      await consumeMessages(accountId, phones.length, { feature: "API" })
    } catch (err) {
      if (err instanceof QuotaError) {
        return NextResponse.json({ error: err.message }, { status: 402 })
      }
      throw err
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        accountId,
        name: `API broadcast — ${new Date().toISOString()}`,
        messageTemplateId: template.id,
        templateName: template.name,
        templateLanguage: template.language,
        totalRecipients: phones.length,
        status: "SENDING",
      },
    })

    const accessToken = decrypt(config.accessTokenEncrypted)
    let sent = 0,
      failed = 0

    for (const [index, phone] of phones.entries()) {
      const phoneNormalized = String(phone).replace(/\D/g, "")
      if (!phoneNormalized) {
        failed++
        continue
      }
      const contact = await prisma.contact.upsert({
        where: { accountId_phoneNormalized: { accountId, phoneNormalized } },
        create: { accountId, phone, phoneNormalized },
        update: {},
      })
      const recipient = await prisma.broadcastRecipient.create({
        data: { broadcastId: broadcast.id, contactId: contact.id },
      })
      try {
        await sendTemplateMessage(
          config.phoneNumberId,
          accessToken,
          phoneNormalized,
          template.name,
          template.language,
          requiredVariableCount > 0
            ? (variables[index] as unknown[]).map((value) => String(value))
            : []
        )
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", sentAt: new Date() },
        })
        await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { sentCount: { increment: 1 } },
        })
        sent++
      } catch (err) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Failed",
          },
        })
        await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { failedCount: { increment: 1 } },
        })
        failed++
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: sent === 0 && failed > 0 ? "FAILED" : "SENT" },
    })
    return NextResponse.json(
      { data: { broadcastId: broadcast.id, sent, failed } },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
