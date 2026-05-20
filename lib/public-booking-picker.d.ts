export type ProviderPreference = {
  id: string
  label: string
}

export type SequenceOptionLike = {
  startsAt: string
  endsAt?: string
  status?: string
  items?: unknown[]
}

export function providerPreferenceModel(providers: ProviderPreference[]): {
  namedProviders: ProviderPreference[]
  shouldShowProviderPreference: boolean
  defaultProviderId: string
}

export function practiceLocalDateKey(value: string | Date, timeZone: string): string

export function sequenceWeekStartKey(value: string | Date, timeZone: string): string

export function formatWeekRangeLabel(dateKey: string): string

export function practiceLocalTimeMinutes(value: string | Date, timeZone: string): number

export function sequenceOptionKey(option: SequenceOptionLike): string

export function groupSequenceOptionsByLocalDate<T extends SequenceOptionLike>(options: T[], timeZone: string): Array<{
  dateKey: string
  date: Date
  options: T[]
}>

export type SequenceWeekSlot<T extends SequenceOptionLike> = {
  option: T
  dateKey: string
  weekStartKey: string
  startMinutes: number
  endMinutes: number
}

export function buildSequenceWeekGrid<T extends SequenceOptionLike>(options: T[], timeZone: string, requestedWeekStartKey?: string): {
  weeks: Array<{
    weekStartKey: string
    label: string
    optionCount: number
  }>
  selectedWeekStartKey: string
  days: Array<{
    dateKey: string
    weekday: string
    weekdayShort: string
    dayLabel: string
    slots: SequenceWeekSlot<T>[]
  }>
  startHour: number
  endHour: number
  totalMinutes: number
  hourTicks: number[]
}

export function publicBookingDayViewCount(containerWidth: unknown): 1 | 3 | 7

export function visibleSequenceDays<T>(days: T[], viewCount: unknown, requestedStartIndex?: unknown): {
  days: T[]
  startIndex: number
  viewCount: number
  canPageBackward: boolean
  canPageForward: boolean
}
