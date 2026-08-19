const SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
}

// Indian number grouping (lakhs / crores) is the default so numbers read
// naturally for teams billing in INR.
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
}

export function formatCurrency(amount: number, currency: string = "INR") {
  const symbol = SYMBOLS[currency] ?? `${currency} `
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US"
  return `${symbol}${Math.round(amount).toLocaleString(locale)}`
}
