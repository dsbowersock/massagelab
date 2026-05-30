import { TherapistNotesGate } from "../therapist-notes-gate"
import RomClientPage from "./client-page"

export default function RomPage() {
  return (
    <TherapistNotesGate>
      <RomClientPage />
    </TherapistNotesGate>
  )
}
