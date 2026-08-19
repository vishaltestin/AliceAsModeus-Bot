export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

export const CUSTOMER_WINDOW_CLOSED_MESSAGE =
  "This customer's 24-hour WhatsApp window is closed. Send an approved template or wait for the customer to message again."

export function isWithinCustomerServiceWindow(
  lastInboundAt: Date | string | null | undefined,
  now = Date.now()
) {
  if (!lastInboundAt) return false
  const timestamp = new Date(lastInboundAt).getTime()
  return (
    Number.isFinite(timestamp) && now - timestamp < CUSTOMER_SERVICE_WINDOW_MS
  )
}
