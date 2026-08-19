import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, ApiAuthError } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp/client"
import { extractVariables, substituteVariables } from "@/lib/whatsapp/templates"
import {
  CUSTOMER_WINDOW_CLOSED_MESSAGE,
  isWithinCustomerServiceWindow,
} from "@/lib/whatsapp/policy"
import { consumeMessages, QuotaError } from "@/lib/quota"

export async function GET(req: NextRequest) {
  try {
    const { accountId } = await authenticateApiRequest(req, "messages:read")
    const conversationId = req.nextUrl.searchParams.get("conversation_id")
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit")) || 50,
      200
    )

    if (conversationId) {
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, accountId },
      })
      if (!conv)
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        )
    }

    const messages = await prisma.message.findMany({
      where: conversationId
        ? { conversationId }
        : { conversation: { accountId } },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json({ data: messages })
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
    const { accountId } = await authenticateApiRequest(req, "messages:send")
    let body: {
      phone?: unknown
      text?: unknown
      template_id?: unknown
      template_params?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    const phone = typeof body.phone === "string" ? body.phone : ""
    const text = typeof body.text === "string" ? body.text : ""
    const templateId =
      typeof body.template_id === "string" ? body.template_id.trim() : ""
    const templateParams = Array.isArray(body.template_params)
      ? body.template_params.filter(
          (param): param is string => typeof param === "string"
        )
      : []

    // A message must be either free-form text or an approved template.
    if (!phone || (!text && !templateId))
      return NextResponse.json(
        { error: "phone and (text or template_id) are required" },
        { status: 400 }
      )

    const phoneNormalized = String(phone).replace(/\D/g, "")
    if (!phoneNormalized)
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      )

    // Resolve the template (approved + scoped to this account) when requested.
    let template: { name: string; language: string; bodyText: string } | null =
      null
    if (templateId) {
      template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, accountId, status: "APPROVED" },
        select: { name: true, language: true, bodyText: true },
      })
      if (!template)
        return NextResponse.json(
          { error: "Approved template not found" },
          { status: 404 }
        )
    }

    const contact = await prisma.contact.upsert({
      where: { accountId_phoneNormalized: { accountId, phoneNormalized } },
      create: { accountId, phone, phoneNormalized },
      update: {},
    })

    let conversation = await prisma.conversation.findFirst({
      where: { accountId, contactId: contact.id, status: { not: "CLOSED" } },
    })
    if (!conversation)
      conversation = await prisma.conversation.create({
        data: { accountId, contactId: contact.id },
      })

    const config = await prisma.whatsAppConfig.findUnique({
      where: { accountId },
    })

    // The 24-hour customer-service window only applies to free-form text,
    // not to approved templates.
    if (
      !template &&
      config?.status === "CONNECTED" &&
      !isWithinCustomerServiceWindow(
        (
          await prisma.message.findFirst({
            where: {
              conversationId: conversation.id,
              senderType: "CUSTOMER",
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          })
        )?.createdAt
      )
    ) {
      return NextResponse.json(
        { error: CUSTOMER_WINDOW_CLOSED_MESSAGE },
        { status: 409 }
      )
    }

    // Build the stored text and ordered Meta body parameters for a template.
    let contentText = text
    let bodyParams: string[] = []
    if (template) {
      const variableNumbers = extractVariables(template.bodyText)
      const paramMap: Record<number, string> = {}
      variableNumbers.forEach((n, i) => {
        paramMap[n] = templateParams[i] ?? ""
      })
      contentText = substituteVariables(template.bodyText, paramMap)
      bodyParams = variableNumbers.map((n) => paramMap[n] ?? "")
    }

    // Reserve one message against the account's quota before sending.
    try {
      await consumeMessages(accountId, 1, {
        feature: "API",
        recipientPhone: phoneNormalized,
      })
    } catch (err) {
      if (err instanceof QuotaError) {
        return NextResponse.json({ error: err.message }, { status: 402 })
      }
      throw err
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "AGENT",
        contentText,
      },
    })
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageText: contentText, lastMessageAt: new Date() },
    })

    if (!config || config.status !== "CONNECTED") {
      const note = "WhatsApp not connected"
      const failedMessage = await prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED", errorMessage: note },
      })
      return NextResponse.json(
        { data: failedMessage, delivered: false, error: note },
        { status: 409 }
      )
    }

    try {
      const accessToken = decrypt(config.accessTokenEncrypted)
      const result = template
        ? await sendTemplateMessage(
            config.phoneNumberId,
            accessToken,
            contact.phoneNormalized,
            template.name,
            template.language,
            bodyParams
          )
        : await sendTextMessage(
            config.phoneNumberId,
            accessToken,
            contact.phoneNormalized,
            text
          )
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          whatsappMessageId: result?.messages?.[0]?.id ?? null,
        },
      })
      return NextResponse.json(
        { data: updated, delivered: true },
        { status: 201 }
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send"
      const failedMessage = await prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED", errorMessage },
      })
      return NextResponse.json(
        { data: failedMessage, delivered: false, error: errorMessage },
        { status: 502 }
      )
    }
  } catch (err) {
    if (err instanceof ApiAuthError)
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: err.headers }
      )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
