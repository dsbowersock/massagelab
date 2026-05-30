import { TherapistNotesGate } from "../therapist-notes-gate"
import SoapClientPage from "./client-page"

export default function SoapNotesPage() {
  return (
    <TherapistNotesGate>
      <SoapClientPage />
    </TherapistNotesGate>
  )
}
