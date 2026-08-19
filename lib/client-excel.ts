// Client-side Excel/CSV parsing built on the `xlsx` library. Kept client-side
// so files never have to be uploaded to the server before parsing. The server
// action that ingests the rows still owns validation and dedupe.
import * as XLSX from "xlsx"

export type ImportRow = {
  phone: string
  name?: string
  email?: string
  company?: string
}

const HEADER_ALIASES: Record<string, string> = {
  phone: "phone",
  mobileno: "phone",
  mobile: "phone",
  mobile_number: "phone",
  phonenumber: "phone",
  contact: "phone",
  contactnumber: "phone",
  whatsapp: "phone",
  name: "name",
  fullname: "name",
  customer: "name",
  email: "email",
  mail: "email",
  emailaddress: "email",
  company: "company",
  organisation: "company",
  organization: "company",
  business: "company",
}

/**
 * Parse an Excel (.xlsx/.xls) or CSV File into contact rows.
 * Returns { rows, errors, totalRows }.
 */
export function parseContactsFile(file: File): {
  rows: ImportRow[]
  errors: string[]
  totalRows: number
} {
  const errors: string[] = []

  // xlsx can read ArrayBuffer directly (handles both .xlsx and .csv).
  // Since readArray reads synchronously we must read the File to an ArrayBuffer
  // first, which is async — so this helper is used from an async caller that
  // already has the buffer, OR we read it here via a sync XHR-style is not
  // possible in browsers. We therefore expose an async variant below.
  void file
  return { rows: [], errors, totalRows: 0 }
}

/**
 * Async variant: reads the File, parses with `xlsx`, and returns contact rows.
 */
export async function parseContactsFileAsync(file: File): Promise<{
  rows: ImportRow[]
  errors: string[]
  totalRows: number
}> {
  const errors: string[] = []
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) return { rows: [], errors: ["The file has no sheets."], totalRows: 0 }

  // Convert to array-of-arrays (header first).
  const raw: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
  })
  if (raw.length < 2) {
    return { rows: [], errors: ["The file needs a header row and at least one contact row."], totalRows: 0 }
  }

  const headers = (raw[0] as unknown[]).map((h) =>
    String(h ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  )
  const colOf = (field: string) => {
    const idx = headers.findIndex((h) => HEADER_ALIASES[h] === field)
    return idx
  }
  const phoneCol = colOf("phone")
  if (phoneCol < 0) {
    return { rows: [], errors: ["The file needs a column named 'phone' (or similar)."], totalRows: 0 }
  }
  const nameCol = colOf("name")
  const emailCol = colOf("email")
  const companyCol = colOf("company")

  const rows: ImportRow[] = []
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[]
    const phone = String(cells[phoneCol] ?? "").trim()
    const row: ImportRow = {
      phone,
      name: nameCol >= 0 ? String(cells[nameCol] ?? "").trim() || undefined : undefined,
      email: emailCol >= 0 ? String(cells[emailCol] ?? "").trim() || undefined : undefined,
      company: companyCol >= 0 ? String(cells[companyCol] ?? "").trim() || undefined : undefined,
    }
    // Skip fully-empty rows.
    if (!phone && !row.name && !row.email && !row.company) continue
    rows.push(row)
  }

  return { rows, errors, totalRows: raw.length - 1 }
}
