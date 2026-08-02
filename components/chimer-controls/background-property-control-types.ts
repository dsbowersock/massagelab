/** Shared contract for renderer-specific Visual property controls. */
export interface BackgroundPropertyControlsProps<TOptions> {
  value: TOptions
  disabled?: boolean
  onChange: (patch: Partial<TOptions>) => void
}
