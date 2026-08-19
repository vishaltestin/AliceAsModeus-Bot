export type WebhookMedia = {
  id?: string
  caption?: string
  filename?: string
}

export type WebhookContact = {
  profile?: { name?: string }
  name?: { formatted_name?: string }
  phones?: { phone?: string }[]
}

export type WebhookLocation = {
  latitude?: number
  longitude?: number
  name?: string
  address?: string
}

export type WebhookMessage = {
  id?: string
  from?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string } }
  contacts?: WebhookContact[]
  location?: WebhookLocation
  sticker?: WebhookMedia
  image?: WebhookMedia
  video?: WebhookMedia
  audio?: WebhookMedia
  document?: WebhookMedia
  [key: string]: unknown
}

export type WebhookStatus = {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
  errors?: { title?: string; message?: string }[]
}

export type WebhookValue = {
  metadata?: { phone_number_id?: string }
  contacts?: WebhookContact[]
  messages?: WebhookMessage[]
  statuses?: WebhookStatus[]
}

export type WebhookPayload = {
  entry?: { changes?: { value?: WebhookValue }[] }[]
}
