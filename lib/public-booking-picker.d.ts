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

export function sequenceOptionKey(option: SequenceOptionLike): string

export function groupSequenceOptionsByLocalDate<T extends SequenceOptionLike>(options: T[], timeZone: string): Array<{
  dateKey: string
  date: Date
  options: T[]
}>
