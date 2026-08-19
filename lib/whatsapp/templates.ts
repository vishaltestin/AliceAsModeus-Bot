interface TemplateFields {
  headerType?: string | null
  headerContent?: string | null
  bodyText: string
  footerText?: string | null
  buttons?: unknown[] | null
}

type MetaComponent = Record<string, unknown>

export function buildMetaComponents(t: TemplateFields): MetaComponent[] {
  const components: MetaComponent[] = []

  if (t.headerType === "TEXT" && t.headerContent) {
    components.push({ type: "HEADER", format: "TEXT", text: t.headerContent })
  } else if (t.headerType && t.headerType !== "TEXT" && t.headerContent) {
    components.push({
      type: "HEADER",
      format: t.headerType,
      example: { header_handle: [t.headerContent] },
    })
  }

  const bodyComponent: MetaComponent = { type: "BODY", text: t.bodyText }
  const variables = extractVariables(t.bodyText)
  if (variables.length > 0) {
    bodyComponent.example = { body_text: [variables.map((v) => `Sample ${v}`)] }
  }
  components.push(bodyComponent)

  if (t.footerText) components.push({ type: "FOOTER", text: t.footerText })
  if (t.buttons && t.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: t.buttons })
  }

  return components
}

export function extractVariables(bodyText: string): number[] {
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) ?? []
  return Array.from(
    new Set(matches.map((m) => Number(m.replace(/\D/g, ""))))
  ).sort((a, b) => a - b)
}

export function substituteVariables(
  bodyText: string,
  values: Record<number, string>
): string {
  return bodyText.replace(
    /\{\{(\d+)\}\}/g,
    (_, n) => values[Number(n)] ?? `{{${n}}}`
  )
}
