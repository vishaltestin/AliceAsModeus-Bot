import { notFound } from "next/navigation"
import { getAccountMembers, getAutomationForEdit } from "../../actions"
import { getTagsAndFields } from "@/app/(dashboard)/contacts/actions"
import { AutomationBuilder } from "../../builder"
import { auth } from "@/lib/auth"
import { assertCanWrite } from "@/lib/permissions"

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  await assertCanWrite(session?.user.accountRole)
  const [members, { tags }, automation] = await Promise.all([
    getAccountMembers(),
    getTagsAndFields(),
    getAutomationForEdit(id).catch(() => null),
  ])
  if (!automation) notFound()

  return (
    <AutomationBuilder members={members} tags={tags} initial={automation} />
  )
}
