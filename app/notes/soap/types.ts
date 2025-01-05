export type SubjectiveEntryType = 
  | "pain"
  | "goal"
  | "medication"
  | "physician-info"
  | "other"

export interface PainEntry {
  type: "pain"
  description: string
  intensity: string
  descriptors: Record<string, boolean>
  pattern: string
  onset: string
  causes: Record<string, boolean>
  preventedActivities: Record<string, boolean>
  worsens: string
  relief: string
  practitioners: Record<string, boolean>
}

export interface GoalEntry {
  type: "goal"
  description: string
  timeframe: string
  priority: "low" | "medium" | "high"
  relatedActivities: string
}

export interface MedicationEntry {
  type: "medication"
  name: string
  dosage: string
  frequency: string
  purpose: string
  prescribedBy: string
  startDate: string
}

export interface PhysicianInfoEntry {
  type: "physician-info"
  physicianName: string
  specialty: string
  diagnosis: string
  treatment: string
  recommendations: string
  lastVisit: string
}

export interface OtherEntry {
  type: "other"
  title: string
  description: string
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
  area: string
  tissueQuality: string
  temperature: string
  tenderness: number
  notes: string
}

export interface ROMEntry {
  type: "rom"
  joint: string
  movement: string
  activeROM: string
  passiveROM: string
  endFeel: string
  pain: boolean
  notes?: string
}

export interface PosturalEntry {
  type: "postural"
  view: string
  findings: string
  compensations: string
}

export interface GaitEntry {
  type: "gait"
  phase: string
  observations: string
  deviations: string
}

export interface SpecialTestEntry {
  type: "special-test"
  testName: string
  result: string
  notes: string
}

export interface TissueEntry {
  type: "tissue"
  area: string
  texture: string
  mobility: string
  findings: string
}

export interface OtherObjectiveEntry {
  type: "other"
  title: string
  description: string
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

