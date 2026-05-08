"use client"

import { useCallback, useEffect, useState } from "react"

export type MeasurementAxis = "alpha" | "beta" | "gamma"

export type DeviceOrientationReading = Record<MeasurementAxis, number | null>

export type SensorCapabilityState =
  | "unsupported"
  | "permission-needed"
  | "active"
  | "denied"
  | "error"

export type DeviceSensorSupport = {
  secureContext: boolean
  deviceOrientation: boolean
  deviceMotion: boolean
  accelerometer: boolean
  gyroscope: boolean
}

export type SensorRequestResult = {
  state: SensorCapabilityState
  message: string
}

type PermissionCapableDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>
}

const emptyOrientation: DeviceOrientationReading = {
  alpha: null,
  beta: null,
  gamma: null,
}

const activeMessage = "Device orientation tracking is active on this device."
const deniedMessage = "Motion permission was not granted."
const unsupportedMessage = "Device orientation tracking is not available in this browser."
const insecureMessage = "Device orientation tracking requires HTTPS or localhost."

function normalizeSensorDegrees(value: number | null) {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10
}

function getOrientationConstructor() {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
    return null
  }

  return DeviceOrientationEvent as PermissionCapableDeviceOrientationEvent
}

export function getDeviceSensorSupport(): DeviceSensorSupport {
  if (typeof window === "undefined") {
    return {
      secureContext: false,
      deviceOrientation: false,
      deviceMotion: false,
      accelerometer: false,
      gyroscope: false,
    }
  }

  return {
    secureContext: window.isSecureContext,
    deviceOrientation: "DeviceOrientationEvent" in window,
    deviceMotion: "DeviceMotionEvent" in window,
    accelerometer: "Accelerometer" in window,
    gyroscope: "Gyroscope" in window,
  }
}

function preflightSensorRequest(): SensorRequestResult {
  const support = getDeviceSensorSupport()

  if (!support.secureContext) {
    return { state: "unsupported", message: insecureMessage }
  }

  if (!support.deviceOrientation || !getOrientationConstructor()) {
    return { state: "unsupported", message: unsupportedMessage }
  }

  return { state: "permission-needed", message: "Enable motion access to use device orientation." }
}

export function useDeviceMotionSensors() {
  const [state, setState] = useState<SensorCapabilityState>("unsupported")
  const [message, setMessage] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<DeviceOrientationReading>(emptyOrientation)
  const [support, setSupport] = useState<DeviceSensorSupport>({
    secureContext: false,
    deviceOrientation: false,
    deviceMotion: false,
    accelerometer: false,
    gyroscope: false,
  })

  useEffect(() => {
    setSupport(getDeviceSensorSupport())
    const result = preflightSensorRequest()
    setState(result.state)
    setMessage(result.message)
  }, [])

  useEffect(() => {
    if (state !== "active") {
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: normalizeSensorDegrees(event.alpha),
        beta: normalizeSensorDegrees(event.beta),
        gamma: normalizeSensorDegrees(event.gamma),
      })
    }

    window.addEventListener("deviceorientation", handleOrientation)
    return () => window.removeEventListener("deviceorientation", handleOrientation)
  }, [state])

  const requestAccess = useCallback(async (): Promise<SensorRequestResult> => {
    const preflight = preflightSensorRequest()

    if (preflight.state === "unsupported") {
      setSupport(getDeviceSensorSupport())
      setState(preflight.state)
      setMessage(preflight.message)
      return preflight
    }

    const orientationConstructor = getOrientationConstructor()

    try {
      if (orientationConstructor?.requestPermission) {
        const permission = await orientationConstructor.requestPermission()

        if (permission !== "granted") {
          const result = { state: "denied" as const, message: deniedMessage }
          setState(result.state)
          setMessage(result.message)
          return result
        }
      }

      const result = { state: "active" as const, message: activeMessage }
      setState(result.state)
      setMessage(result.message)
      return result
    } catch {
      const result = { state: "error" as const, message: unsupportedMessage }
      setState(result.state)
      setMessage(result.message)
      return result
    }
  }, [])

  return {
    state,
    message,
    orientation,
    support,
    requestAccess,
    isAvailable: state === "permission-needed" || state === "active",
  }
}
