import type { ReactNode } from "react"
import { ProfessionalRecordVaultProvider } from "./professional-record-vault-provider"

export default function NotesLayout({ children }: { children: ReactNode }) {
  return <ProfessionalRecordVaultProvider>{children}</ProfessionalRecordVaultProvider>
}
