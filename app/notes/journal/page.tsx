import { TherapistNotesGate } from "../therapist-notes-gate"
import JournalClientPage from "./client-page"

export default function JournalPage() {
  return (
    <TherapistNotesGate>
      <JournalClientPage />
    </TherapistNotesGate>
  )
}
