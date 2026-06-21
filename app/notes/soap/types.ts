import type { Dispatch, SetStateAction } from "react"

export type SubjectiveEntryType = 
  | "pain"
  | "goal"
  | "medication"
  | "physician-info"
  | "other"

export interface PainEntry {
  type: "pain"
  description?: string
  briefDescription?: string
  intensity?: string
  descriptors?: Record<string, boolean>
  sensations?: Record<string, boolean>
  areas?: Record<string, boolean>
  pattern?: string
  onset?: string
  causes?: Record<string, boolean>
  incidents?: Record<string, boolean>
  preventedActivities?: Record<string, boolean>
  worsens?: string
  relief?: string
  practitioners?: Record<string, boolean>
  markingDetails?: Record<string, string>
}

export interface GoalEntry {
  type: "goal"
  description?: string
  timeframe?: string
  priority?: "low" | "medium" | "high"
  relatedActivities?: string
}

export interface MedicationEntry {
  type: "medication"
  name?: string
  dosage?: string
  frequency?: string
  purpose?: string
  prescribedBy?: string
  startDate?: string
}

export interface PhysicianInfoEntry {
  type: "physician-info"
  physicianName?: string
  specialty?: string
  diagnosis?: string
  treatment?: string
  recommendations?: string
  lastVisit?: string
}

export interface OtherEntry {
  type: "other"
  title?: string
  description?: string
}

export type SubjectiveEntry = 
  | PainEntry 
  | GoalEntry 
  | MedicationEntry 
  | PhysicianInfoEntry 
  | OtherEntry

export interface SubjectiveInfo {
  generalNotes: string
  entries: SubjectiveEntry[]
}

export type ObjectiveEntryType = 
  | "palpation"
  | "rom"
  | "postural"
  | "gait"
  | "special-test"
  | "tissue"
  | "other"

export interface PalpationEntry {
  type: "palpation"
  area?: string
  tissueQuality?: string
  temperature?: string
  tenderness?: number
  notes?: string
}

export interface ROMEntry {
  type: "rom"
  joint?: string
  movement?: string
  activeROM?: string
  passiveROM?: string
  activeAssistiveROM?: string
  resistedROM?: string
  romDegrees?: string
  endFeel?: string
  pain?: boolean
  notes?: string
}

export interface PosturalEntry {
  type: "postural"
  view?: string
  findings?: string
  compensations?: string
}

export interface GaitEntry {
  type: "gait"
  phase?: string
  observations?: string
  deviations?: string
}

export interface SpecialTestEntry {
  type: "special-test"
  testName?: string
  result?: string
  notes?: string
}

export interface TissueEntry {
  type: "tissue"
  area?: string
  texture?: string
  mobility?: string
  findings?: string
}

export interface OtherObjectiveEntry {
  type: "other"
  title?: string
  description?: string
}

export type ObjectiveEntry = 
  | PalpationEntry 
  | ROMEntry 
  | PosturalEntry 
  | GaitEntry 
  | SpecialTestEntry 
  | TissueEntry 
  | OtherObjectiveEntry

export interface ObjectiveInfo {
  generalObservations: string
  entries: ObjectiveEntry[]
}

export type PainMapSide = "left" | "right" | "bilateral" | "center"

export type PainMapView = "front" | "back" | "side"

export interface PainMapSelection {
  id: string
  regionId: string
  side: PainMapSide
  view: PainMapView
  intensity: number
  symptomTypes: string[]
  descriptors: string[]
  notes: string
  anatomyTermIds: string[]
}

export type TranscriptTargetSoapSection =
  | "generalNotes"
  | "generalObservations"
  | "assessment.findings"
  | "assessment.clinicalNotes"
  | "treatmentPlan.notes"

export interface TranscriptSegment {
  id: string
  text: string
  source: "paste" | "import"
  timestampRange: string
  selected: boolean
  targetSoapSection: TranscriptTargetSoapSection
}

/**
 * Structured assessment technique captured inside a local SOAP draft.
 * These fields are user-entered clinical notes only; validation should keep
 * them as strings and leave storage inside the encrypted browser vault.
 */
export interface AssessmentTechniqueEntry {
  technique: string
  area: string
  reasoning: string
  outcome: string
}

/**
 * Complete client-side SOAP form state for the local-first v2 note editor.
 *
 * `schemaVersion` and `noteType` are invariants pinned during normalization so
 * section components can share one state object without re-checking document
 * identity or legacy array shape on every render.
 */
export interface SoapNoteData {
  schemaVersion: 2
  noteType: "soap"
  clientName: string
  dateOfBirth: string
  date: string
  time: string
  therapistName: string
  location: string
  licenseNumber: string
  licenseOrganization: string
  npiNumber: string
  clientNumber: string
  generalNotes: string
  subjectiveEntries: SubjectiveEntry[]
  generalObservations: string
  objectiveEntries: ObjectiveEntry[]
  consentName: string
  consentDate: string
  consentInitials: string
  consentAcknowledged: boolean
  assessment: {
    overallAssessment: string
    techniques: AssessmentTechniqueEntry[]
    findings: string
    clinicalNotes: string
  }
  treatmentPlan: {
    nextSession: string
    frequency: string
    homeCare: string
    referrals: string
    notes: string
  }
  bodyDiagram: {
    regions: string
    notes: string
    painMapSelections: PainMapSelection[]
    googleImportNotes: string
  }
  transcriptSegments: TranscriptSegment[]
}

/**
 * React setter shared by SOAP section components so updates can be direct
 * replacements or functional patches against the current note state.
 */
export type SoapNoteStateSetter = Dispatch<SetStateAction<SoapNoteData>>

/**
 * Standard props for SOAP editor sections: render from the normalized note and
 * write changes through the shared state setter without owning storage.
 */
export type SoapNoteSectionProps = {
  formData: SoapNoteData
  setFormData: SoapNoteStateSetter
}

