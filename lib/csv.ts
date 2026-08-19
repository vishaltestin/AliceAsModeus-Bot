export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === "," && !quoted) {
      row.push(value)
      value = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1
      row.push(value)
      value = ""
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
      row = []
      continue
    }

    value += character
  }

  if (value !== "" || row.length > 0) {
    row.push(value)
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
  }

  return rows
}
