export type AppointmentActionState = {
  status: "idle" | "outside-availability" | "error"
  message: string
  overrideKey?: string
}
