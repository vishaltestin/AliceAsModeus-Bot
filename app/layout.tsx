import type { Metadata } from "next"
import { display, body, mono } from "@/app/fonts"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: {
    default: "FueledInbox — WhatsApp CRM",
    template: "%s · FueledInbox",
  },
  description:
    "A premium shared inbox and customer relationship workspace for WhatsApp teams.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-[family-name:var(--font-body)]`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
