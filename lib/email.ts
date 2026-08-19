export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string
  name: string | null
  resetUrl: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    console.warn(
      "[wacrm] Password reset email not sent: RESEND_API_KEY/RESEND_FROM_EMAIL are not configured",
      { to }
    )
    return { sent: false as const }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your wacrm password",
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#101828"><p style="color:#1f6f5c;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px">wacrm</p><h1 style="font-size:28px;letter-spacing:-.03em">Reset your password</h1><p>Hi ${escapeHtml(name || "there")},</p><p>Use the button below to create a new password. This link expires in one hour.</p><p><a href="${resetUrl}" style="display:inline-block;background:#1f6f5c;color:white;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:600">Reset password</a></p><p style="color:#4b5259;font-size:13px">If you did not request this, you can safely ignore this email.</p></div>`,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Password reset email failed (${response.status}): ${detail.slice(0, 200)}`
    )
  }
  return { sent: true as const }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character
  )
}
