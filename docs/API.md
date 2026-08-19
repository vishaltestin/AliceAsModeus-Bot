# wacrm API v1

The wacrm REST API lets external systems read contacts and conversations, send text messages, and launch approved-template broadcasts.

> **Interactive reference:** an in-app documentation page with scopes, endpoint parameters, error codes, rate limits, and copy-paste code samples (curl / Node.js / Python) is available at **Settings → API Docs** (`/settings/api-docs`). A ready-to-import **Postman collection** lives at `/public/wacrm-api.postman_collection.json` (also downloadable from the docs page).

Base URL:

```text
https://your-wacrm-domain.example.com/api/v1
```

## Authentication

Create an API key in **Settings → API Keys**. Send it with every request:

```http
Authorization: Bearer wacrm_live_...
Content-Type: application/json
```

API keys are scoped. A request without the required scope returns `403`.

Available scopes:

| Scope                | Allows                            |
| -------------------- | --------------------------------- |
| `contacts:read`      | List contacts                     |
| `contacts:write`     | Create or update contacts         |
| `conversations:read` | List conversations                |
| `messages:read`      | Read messages                     |
| `messages:send`      | Send text WhatsApp messages       |
| `broadcasts:send` | Send approved-template broadcasts |

`GET /me` requires no scope and is the recommended first request.

## Common response shape

Successful collection responses use `data`:

```json
{
  "data": []
}
```

Errors use:

```json
{
  "error": "Human-readable explanation"
}
```

Common status codes:

| Status | Meaning                                                            |
| ------ | ------------------------------------------------------------------ |
| `200`  | Request succeeded                                                  |
| `201`  | Resource/message created                                           |
| `400`  | Invalid request body or parameters                                 |
| `401`  | Missing, invalid, expired, or revoked API key                      |
| `403`  | API key is missing the required scope                              |
| `404`  | Resource not found in this account                                 |
| `409`  | WhatsApp is not connected or the customer-service window is closed |
| `502`  | Meta/WhatsApp rejected the send                                    |

## Verify a key

```bash
curl https://your-wacrm-domain.example.com/api/v1/me \\
  -H "Authorization: Bearer wacrm_live_your_key"
```

Example response:

```json
{
  "account": {
    "id": "account_id",
    "name": "Acme Support"
  },
  "scopes": ["contacts:read", "messages:send"]
}
```

## Contacts

### List contacts

Requires `contacts:read`.

```bash
curl "https://your-wacrm-domain.example.com/api/v1/contacts?limit=50" \\
  -H "Authorization: Bearer wacrm_live_your_key"
```

`limit` defaults to `50` and is capped at `200`.

Contact records include the category, which is one of:

```text
LEAD, PROSPECT, CUSTOMER, VIP, OTHER
```

### Create or update a contact

Requires `contacts:write`.

The endpoint upserts by normalized phone number within the authenticated account.

```bash
curl -X POST https://your-wacrm-domain.example.com/api/v1/contacts \\
  -H "Authorization: Bearer wacrm_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+14155550123",
    "name": "Jordan Lee",
    "email": "jordan@example.com",
    "company": "Acme",
    "category": "PROSPECT"
  }'
```

`phone` is required. Valid categories are `LEAD`, `PROSPECT`, `CUSTOMER`, `VIP`, and `OTHER`.

## Conversations

### List conversations

Requires `conversations:read`.

```bash
curl "https://your-wacrm-domain.example.com/api/v1/conversations?limit=50" \\
  -H "Authorization: Bearer wacrm_live_your_key"
```

The response is always limited to conversations in the API key's account.

## Messages

### Read messages

Requires `messages:read`.

Read recent messages across the account:

```bash
curl "https://your-wacrm-domain.example.com/api/v1/messages?limit=50" \\
  -H "Authorization: Bearer wacrm_live_your_key"
```

Read messages for one conversation:

```bash
curl "https://your-wacrm-domain.example.com/api/v1/messages?conversation_id=conversation_id" \\
  -H "Authorization: Bearer wacrm_live_your_key"
```

### Send a text message

Requires `messages:send`.

```bash
curl -X POST https://your-wacrm-domain.example.com/api/v1/messages \\
  -H "Authorization: Bearer wacrm_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+14155550123",
    "text": "Thanks for reaching out — our team will be with you shortly."
  }'
```

The API creates or reuses an open conversation for the phone number.

### Send an approved template message

Requires `messages:send`.

Templates bypass WhatsApp's 24-hour customer-service window, so they work any
time. Pass the `id` of an **approved** template (from the account's Templates
area) and the body variables in `template_params`, in the order `{{1}}`, `{{2}}`,
... appear in the template body.

```bash
curl -X POST https://your-wacrm-domain.example.com/api/v1/messages \\
  -H "Authorization: Bearer wacrm_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+14155550123",
    "template_id": "template_id",
    "template_params": ["Jordan", "#1042"]
  }'
```

If the template has no body variables, `template_params` may be omitted or empty.

### WhatsApp 24-hour rule

Free-form text messages can only be sent when the customer has messaged the business within the previous 24 hours. Outside that window, the API returns `409` with an explanation. Send an approved template broadcast instead, or wait for the customer to message again.

## Broadcasts

### Send an approved-template broadcast

Requires `broadcasts:send`.

For a template without variables:

```bash
curl -X POST https://your-wacrm-domain.example.com/api/v1/broadcasts \\
  -H "Authorization: Bearer wacrm_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateName": "store_hours",
    "language": "en_US",
    "phones": ["+14155550123", "+14155550124"]
  }'
```

For a template with variables, provide one variable array per phone, in template order:

```bash
curl -X POST https://your-wacrm-domain.example.com/api/v1/broadcasts \\
  -H "Authorization: Bearer wacrm_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateName": "order_update",
    "language": "en_US",
    "phones": ["+14155550123", "+14155550124"],
    "variables": [
      ["Jordan", "#1042"],
      ["Sam", "#1043"]
    ]
  }'
```

Broadcast limits:

- Maximum `1,000` phones per API request.
- Approved templates only.
- Variable templates require a variable array for every phone.
- Invalid phone values are counted as failed recipients.

Example response:

```json
{
  "data": {
    "broadcastId": "broadcast_id",
    "sent": 1,
    "failed": 1
  }
}
```

## Operational notes

- API keys are account-scoped; IDs from another account are never returned.
- Revoke keys immediately if an integration is compromised.
- Keep API keys on the server side of your integration. Do not expose them in browser code.
- WhatsApp media sending is currently handled by the authenticated CRM inbox. The public API v1 currently exposes text messages and template broadcasts.
- Webhook delivery-status updates are processed by the Meta webhook endpoint, not by polling the public API.
