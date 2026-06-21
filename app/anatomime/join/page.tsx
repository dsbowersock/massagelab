import { AnatomimeSharedSessionClient } from "../shared-session-client"

type JoinPageSearchParams = Promise<{
  code?: string | string[]
}>

export default async function AnatomimeJoinPage({ searchParams }: { searchParams?: JoinPageSearchParams }) {
  const params = await searchParams
  const rawCode = Array.isArray(params?.code) ? params.code[0] : params?.code
  const initialCode = typeof rawCode === "string" ? rawCode : ""

  return <AnatomimeSharedSessionClient initialCode={initialCode} />
}
