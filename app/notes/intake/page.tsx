import { TherapistNotesGate } from "../therapist-notes-gate"
import IntakeClientPage from "./client-page"

export default function IntakePage() {
  return (
    <TherapistNotesGate>
      <IntakeClientPage />
    </TherapistNotesGate>
  )
}
