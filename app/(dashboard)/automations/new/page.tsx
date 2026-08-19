import { getAccountMembers } from "../actions"
import { getTagsAndFields } from "@/app/(dashboard)/contacts/actions"
import { AutomationBuilder } from "../builder"
import { auth } from "@/lib/auth"
import { assertCanWrite } from "@/lib/permissions"

export default async function NewAutomationPage() {
  const session = await auth()
  await assertCanWrite(session?.user.accountRole)
  const [members, { tags }] = await Promise.all([
    getAccountMembers(),
    getTagsAndFields(),
  ])
  return <AutomationBuilder members={members} tags={tags} />
}
