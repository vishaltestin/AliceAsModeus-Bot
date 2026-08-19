import { ResetPasswordForm } from "./form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] | undefined }>
}) {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : ""
  return <ResetPasswordForm token={token} />
}
