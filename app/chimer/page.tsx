"use client"

import { useState, useEffect, useRef } from "react"
import { Orbitron } from 'next/font/google'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SetTimer } from "./set-timer"
import { RunningTimer } from "./running-timer"

const orbitron = Orbitron({ subsets: ['latin'] })

export default function ChimerPage() {
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timeDisplay, setTimeDisplay] = useState({ hours: "00", minutes: "00", seconds: "00" })
  const [isPaused, setIsPaused] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState("")

  // Settings state
  const [intervalType, setIntervalType] = useState("preset")
  const [customInterval, setCustomInterval] = useState(5)
  const [areasToMassage, setAreasToMassage] = useState(4)
  const [alertType, setAlertType] = useState("chime")

  // Time selection modal state
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<"hours" | "minutes">("minutes")

  // Font size state for running timer
  const [fontSize, setFontSize] = useState(20)

  // Refs for timer functionality
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const endTime = useRef<number | null>(null)
  const remainingTime = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3")
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours() % 12 || 12
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
      setCurrentTime(`${hours}:${minutes} ${ampm}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Timer countdown logic
  const updateDisplay = (timeInMs: number) => {
    const hours = Math.floor(timeInMs / (1000 * 60 * 60))
    const minutes = Math.floor((timeInMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeInMs % (1000 * 60)) / 1000)

    setTimeDisplay({
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0')
    })
  }

  const startCountdown = () => {
    if (timerInterval.current) clearInterval(timerInterval.current)

    timerInterval.current = setInterval(() => {
      if (endTime.current && remainingTime.current) {
        const now = Date.now()
        const remaining = endTime.current - now

        if (remaining <= 0) {
          handleInterval()
        } else {
          remainingTime.current = remaining
          updateDisplay(remaining)
        }
      }
    }, 100)
  }

  const handleInterval = () => {
    if (timerInterval.current) clearInterval(timerInterval.current)

    // Play sound alert if selected
    if (alertType === "chime" && audioRef.current) {
      audioRef.current.play().catch(console.error)
    }

    // Visual alert if selected
    if (alertType === "flash") {
      document.body.style.backgroundColor = "#ffffff"
      setTimeout(() => {
        document.body.style.backgroundColor = ""
      }, 100)
    }

    // Calculate next interval
    let intervalMs: number
    if (intervalType === "preset" || intervalType === "custom") {
      intervalMs = customInterval * 60 * 1000 // Convert minutes to milliseconds
    } else {
      // For areas mode, divide total time by number of areas
      const totalTimeMs = remainingTime.current || 0
      intervalMs = totalTimeMs / areasToMassage
    }

    // Set up next interval
    endTime.current = Date.now() + intervalMs
    remainingTime.current = intervalMs
    startCountdown()
  }

  const openTimeModal = (unit: "hours" | "minutes") => {
    setSelectedTimeUnit(unit)
    setShowTimeModal(true)
  }

  const handleTimeSelection = (value: string) => {
    setTimeDisplay(prev => ({
      ...prev,
      [selectedTimeUnit]: value.padStart(2, '0')
    }))
    setShowTimeModal(false)
  }

  const startTimer = () => {
    // Convert display time to milliseconds
    const hours = parseInt(timeDisplay.hours) * 60 * 60 * 1000
    const minutes = parseInt(timeDisplay.minutes) * 60 * 1000
    const totalTime = hours + minutes

    if (totalTime <= 0) {
      alert("Please set a time greater than zero")
      return
    }

    endTime.current = Date.now() + totalTime
    remainingTime.current = totalTime
    setIsTimerRunning(true)
    setIsPaused(false)
    startCountdown()
  }

  const endTimer = () => {
    if (timerInterval.current) clearInterval(timerInterval.current)
    setIsTimerRunning(false)
    setIsFullscreen(false)
    setTimeDisplay({ hours: "00", minutes: "00", seconds: "00" })
    endTime.current = null
    remainingTime.current = null
  }

  const togglePause = () => {
    setIsPaused(prev => {
      if (!prev) { // Pausing
        if (timerInterval.current) clearInterval(timerInterval.current)
        if (endTime.current) {
          remainingTime.current = endTime.current - Date.now()
        }
      } else { // Resuming
        if (remainingTime.current) {
          endTime.current = Date.now() + remainingTime.current
          startCountdown()
        }
      }
      return !prev
    })
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleIncreaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 5, 40))
  }

  const handleDecreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 5, 10))
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="w-full bg-[#2d2d2d] p-5 rounded-lg shadow-lg">
          {!isTimerRunning ? (
            <SetTimer
              timeDisplay={timeDisplay}
              intervalType={intervalType}
              customInterval={customInterval}
              areasToMassage={areasToMassage}
              alertType={alertType}
              onTimeClick={openTimeModal}
              onIntervalTypeChange={setIntervalType}
              onCustomIntervalChange={setCustomInterval}
              onAreasChange={setAreasToMassage}
              onAlertTypeChange={setAlertType}
              onStartTimer={startTimer}
            />
          ) : (
            <RunningTimer
              timeDisplay={timeDisplay}
              currentTime={currentTime}
              isPaused={isPaused}
              isFullscreen={isFullscreen}
              fontSize={fontSize}
              onClose={endTimer}
              onPause={togglePause}
              onFullscreen={toggleFullscreen}
              onIncreaseFontSize={handleIncreaseFontSize}
              onDecreaseFontSize={handleDecreaseFontSize}
            />
          )}

          <Dialog open={showTimeModal} onOpenChange={setShowTimeModal}>
            <DialogContent className="bg-[#2a2a2a] border-[#444] p-6">
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  Set {selectedTimeUnit.charAt(0).toUpperCase() + selectedTimeUnit.slice(1)}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
                {Array.from({ length: selectedTimeUnit === 'hours' ? 24 : 60 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleTimeSelection(i.toString())}
                    className="p-3 bg-[#1a1a1a] hover:bg-[#FF7F50] text-white rounded-lg transition-colors"
                  >
                    {i.toString().padStart(2, '0')}
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

