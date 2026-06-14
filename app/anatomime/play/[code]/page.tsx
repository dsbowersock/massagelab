import { AnatomimeSharedSessionClient } from "../../shared-session-client"

export default async function AnatomimePlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  return <AnatomimeSharedSessionClient initialCode={code} />
}
