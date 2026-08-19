const GRAPH_API_VERSION = "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message)
  }
}

async function graphFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new WhatsAppApiError(
      json?.error?.message ?? `Meta API error (${res.status})`,
      res.status,
      json
    )
  }
  return json
}

export async function verifyPhoneNumber(
  phoneNumberId: string,
  accessToken: string
) {
  return graphFetch(
    `/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    accessToken
  )
}

export async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  return graphFetch(`/${wabaId}/subscribed_apps`, accessToken, {
    method: "POST",
  })
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
) {
  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  })
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string,
  bodyParams: string[]
) {
  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components:
          bodyParams.length > 0
            ? [
                {
                  type: "body",
                  parameters: bodyParams.map((p) => ({
                    type: "text",
                    text: p,
                  })),
                },
              ]
            : undefined,
      },
    }),
  })
}

export async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaType: "image" | "video" | "audio" | "document" | "sticker",
  link: string,
  caption?: string,
  filename?: string
) {
  const mediaObject: Record<string, unknown> = { link }
  if (caption && mediaType !== "audio" && mediaType !== "sticker")
    mediaObject.caption = caption
  if (filename && mediaType === "document") mediaObject.filename = filename

  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      [mediaType]: mediaObject,
    }),
  })
}

export async function sendContactMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  name: string,
  phone: string
) {
  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "contacts",
      contacts: [
        {
          name: {
            formatted_name: name,
            first_name: name.split(" ")[0] || name,
          },
          phones: [{ phone, type: "CELL" }],
        },
      ],
    }),
  })
}

export async function sendLocationMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string
) {
  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "location",
      location: { latitude, longitude, name, address },
    }),
  })
}

export async function getMediaUrl(mediaId: string, accessToken: string) {
  return graphFetch(`/${mediaId}`, accessToken)
}

export async function createMessageTemplate(
  wabaId: string,
  accessToken: string,
  payload: Record<string, unknown>
) {
  return graphFetch(`/${wabaId}/message_templates`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export async function updateMessageTemplateOnMeta(
  metaTemplateId: string,
  accessToken: string,
  payload: Record<string, unknown>
) {
  return graphFetch(`/${metaTemplateId}`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export async function listMessageTemplates(
  wabaId: string,
  accessToken: string
) {
  return graphFetch(
    `/${wabaId}/message_templates?fields=name,category,language,status,components,quality_score,rejected_reason&limit=100`,
    accessToken
  )
}
