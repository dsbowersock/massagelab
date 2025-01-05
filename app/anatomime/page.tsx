"use client"

import { useState, useEffect, useRef } from "react"
import { musclesByArea } from "./data"
import { PageHeading } from "@/components/ui/page-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import "./styles.css"
import dynamic from 'next/dynamic'
const Confetti = dynamic(() => import('react-confetti'), { ssr: false })

export default function AnatomimePage() {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([])
  const [currentMuscleIndex, setCurrentMuscleIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [scores, setScores] = useState([0, 0])
  const [currentTeam, setCurrentTeam] = useState(0)
  const [gamePhase, setGamePhase] = useState<'onboarding' | 'selection' | 'setup' | 'playing' | 'roundEnd' | 'end'>('onboarding')
  const [availableMuscles, setAvailableMuscles] = useState<string[]>([])
  const [bonusTime, setBonusTime] = useState(0)
  const [randomMuscles, setRandomMuscles] = useState<string[]>([])
  const [numberOfTeams, setNumberOfTeams] = useState<"2" | "3" | "4">("2")
  const [teamNames, setTeamNames] = useState<string[]>(["Team 1", "Team 2"])
  const timerInterval = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const num = parseInt(numberOfTeams)
    setTeamNames(prev => {
      const newTeams = [...prev]
      while (newTeams.length < num) {
        newTeams.push(`Team ${newTeams.length + 1}`)
      }
      while (newTeams.length > num) {
        newTeams.pop()
      }
      return newTeams
    })
    setScores(new Array(num).fill(0))
  }, [numberOfTeams])

  const handleTeamNameChange = (index: number, name: string) => {
    setTeamNames(prev => {
      const newNames = [...prev]
      newNames[index] = name
      return newNames
    })
  }

  const startGameSetup = () => {
    if (teamNames.some(name => !name.trim())) {
      alert('Please enter names for all teams')
      return
    }
    setGamePhase('selection')
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    const areaCheckboxes = document.querySelectorAll('.area-checkbox:not(#select-all)') as NodeListOf<HTMLInputElement>
    areaCheckboxes.forEach(checkbox => {
      checkbox.checked = checked
    })
    setSelectedAreas(checked ? Object.keys(musclesByArea) : [])
  }

  const handleAreaChange = (areaId: string, checked: boolean) => {
    setSelectedAreas(prev => {
      const newAreas = checked 
        ? [...prev, areaId]
        : prev.filter(id => id !== areaId)
      return newAreas
    })
  }

  const continueToGame = () => {
    const newSelectedAreas = Array.from(document.querySelectorAll('.area-checkbox:not(#select-all):checked'))
      .map(checkbox => (checkbox as HTMLInputElement).id)
    
    if (newSelectedAreas.length === 0) {
      alert('Please select at least one body area!')
      return
    }

    const muscles = newSelectedAreas.flatMap(area => musclesByArea[area])
    setAvailableMuscles([...new Set(muscles)])
    const randomSelection = shuffleArray([...new Set(muscles)]).slice(0, 4)
    setRandomMuscles(randomSelection)
    setGamePhase('setup')
  }

  const shuffleArray = (array: string[]) => {
    const arrayCopy = [...array]
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]]
    }
    return arrayCopy
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, muscle: string) => {
    e.dataTransfer.setData('text/plain', muscle)
    const target = e.target as HTMLDivElement
    target.style.opacity = '0.5'
  }

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    target.style.opacity = '1'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const muscle = e.dataTransfer.getData('text/plain')
    if (!selectedMuscles.includes(muscle)) {
      setSelectedMuscles(prev => [...prev, muscle])
    }
  }

  const startGame = () => {
    if (selectedMuscles.length !== 4) {
      alert('Please arrange all 4 muscles in your preferred order!')
      return
    }
    setGamePhase('playing')
    setTimeRemaining(30)
    setCurrentMuscleIndex(0)
    setBonusTime(0)
    // Start timer on next tick to ensure state updates are complete
    setTimeout(startTimer, 0)
  }

  const startTimer = () => {
    // Clear any existing interval first
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    
    // Create new interval
    timerInterval.current = setInterval(() => {
      setTimeRemaining(prev => {
        // If time is up
        if (prev <= 1) {
          if (timerInterval.current) {
            clearInterval(timerInterval.current)
          }
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleTimeUp = () => {
    // Clear existing interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }

    // Move to next muscle
    setCurrentMuscleIndex(prev => {
      const nextIndex = prev + 1
      if (nextIndex < selectedMuscles.length) {
        // Schedule timer start for next tick to ensure state updates
        setTimeout(() => {
          setTimeRemaining(30)
          setBonusTime(0)
          startTimer()
        }, 0)
        return nextIndex
      } else {
        // End turn if no more muscles
        endTurn()
        return prev
      }
    })
  }

  const handleCorrectAnswer = () => {
    // Clear existing interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }

    // Update score
    setScores(prev => {
      const newScores = [...prev]
      newScores[currentTeam]++
      return newScores
    })
    
    // Calculate bonus time
    const currentBonusTime = timeRemaining
    setBonusTime(currentBonusTime)
    
    // Move to next muscle or end turn
    if (currentMuscleIndex < selectedMuscles.length - 1) {
      setCurrentMuscleIndex(prev => prev + 1)
      // Schedule timer start for next tick with bonus time
      setTimeout(() => {
        setTimeRemaining(30 + currentBonusTime)
        startTimer()
      }, 0)
    } else {
      endTurn()
    }
  }

  const endTurn = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    setGamePhase('roundEnd')
  }

  const continueToNextTeam = () => {
    setSelectedMuscles([])
    setCurrentMuscleIndex(0)
    setTimeRemaining(30)
    setBonusTime(0)
    setCurrentTeam(prev => (prev + 1) % parseInt(numberOfTeams))
    setGamePhase('setup')
    const randomSelection = shuffleArray([...availableMuscles]).slice(0, 4)
    setRandomMuscles(randomSelection)
  }

  const endGame = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    setGamePhase('end')
  }

  const startNewGame = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    
    setSelectedAreas([])
    setSelectedMuscles([])
    setCurrentMuscleIndex(0)
    setTimeRemaining(30)
    setScores(new Array(parseInt(numberOfTeams)).fill(0))
    setCurrentTeam(0)
    setBonusTime(0)
    setGamePhase('onboarding')
    setAvailableMuscles([])
    setRandomMuscles([])
    document.querySelectorAll('.area-checkbox').forEach((checkbox: any) => {
      checkbox.checked = false
    })
  }

  useEffect(() => {
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [])

  useEffect(() => {
    // Cleanup function to clear interval when component unmounts
    // or when game phase changes
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [gamePhase]) // Add gamePhase as dependency

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="game-container">
          <div className={`onboarding-phase ${gamePhase !== 'onboarding' ? 'hidden' : ''}`}>
            <PageHeading>
              Welcome to Anatomime! 🎯
            </PageHeading>
            
            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="text-lg">Number of Teams</Label>
                <RadioGroup
                  defaultValue="2"
                  onValueChange={(value) => setNumberOfTeams(value as "2" | "3" | "4")}
                  className="flex flex-wrap gap-4"
                >
                  {["2", "3", "4"].map((num) => (
                    <div key={num} className="flex items-center space-x-2">
                      <RadioGroupItem value={num} id={`teams-${num}`} />
                      <Label htmlFor={`teams-${num}`}>{num} Teams</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="text-lg">Team Names</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {teamNames.map((name, index) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`team-${index + 1}`}>Team {index + 1}</Label>
                      <Input
                        id={`team-${index + 1}`}
                        value={name}
                        onChange={(e) => handleTeamNameChange(index, e.target.value)}
                        placeholder={`Enter Team ${index + 1} name`}
                        className="bg-background"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={startGameSetup}
                className="w-full p-3 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md"
              >
                Start Game Setup
              </Button>
            </div>
          </div>

          <div className={`area-selection-phase ${gamePhase !== 'selection' ? 'hidden' : ''}`}>
            <PageHeading>
              Choose Your Challenge Areas! 🎯 🧠
            </PageHeading>
            <div className="area-selection grid grid-cols-1 md:grid-cols-2 gap-5 p-2.5">
              <div className="col-span-full max-w-[300px] mx-auto">
                <input 
                  type="checkbox" 
                  id="select-all" 
                  className="area-checkbox" 
                  onChange={handleSelectAll}
                  checked={selectedAreas.length === Object.keys(musclesByArea).length}
                />
                <label htmlFor="select-all" className="area-label">
                  Select/Deselect All
                </label>
              </div>
              
              {Object.keys(musclesByArea).map((areaId) => (
                <div key={areaId} className={areaId === 'lower-extremity' ? 'col-span-full max-w-[300px] mx-auto' : ''}>
                  <input 
                    type="checkbox" 
                    id={areaId} 
                    className="area-checkbox" 
                    checked={selectedAreas.includes(areaId)}
                    onChange={(e) => handleAreaChange(areaId, e.target.checked)}
                  />
                  <label htmlFor={areaId} className="area-label">
                    {areaId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </label>
                </div>
              ))}
            </div>
            <button 
              onClick={continueToGame}
              className="mt-6 w-full p-3 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md"
            >
              Continue
            </button>
          </div>

          <div className={`setup-phase ${gamePhase !== 'setup' ? 'hidden' : ''}`}>
            <h2 className="text-2xl font-bold text-[#ff7043] mb-6">Team {currentTeam + 1}'s Random Muscles:</h2>
            <div className="muscle-selection grid grid-cols-2 gap-5 max-w-[600px] mx-auto mb-6">
              {randomMuscles.map((muscle, index) => (
                <div
                  key={index}
                  className="muscle-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, muscle)}
                  onDragEnd={handleDragEnd}
                >
                  {muscle}
                </div>
              ))}
            </div>
            <h3 className="text-xl font-bold text-[#ff7043] mb-4">Arrange your muscles in the order you want to present them:</h3>
            <div 
              className="selected-muscles"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {selectedMuscles.map((muscle, index) => (
                <div key={index} className="muscle-card">
                  {muscle}
                </div>
              ))}
            </div>
            <button 
              onClick={startGame}
              className="w-full p-3 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md"
            >
              Start Game
            </button>
          </div>

          <div className={`game-phase ${gamePhase !== 'playing' ? 'hidden' : ''}`}>
            <div className="score-board">
              {teamNames.map((name, index) => (
                <div key={index} className="team-score">{name}: {scores[index]}</div>
              ))}
            </div>
            <div className="timer">{timeRemaining}</div>
            <div className="current-muscle">
              {selectedMuscles[currentMuscleIndex]}
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleCorrectAnswer}
                className="flex-1 p-3 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md"
              >
                Got It!
              </button>
              <button
                onClick={endTurn}
                className="p-3 text-lg font-bold bg-[#d32f2f] text-white rounded-lg hover:bg-[#b71c1c] transition-all duration-300 shadow-md"
              >
                Next Team's Turn
              </button>
              {/* Show End Game button if all teams have played or current team has unbeatable lead */}
              {(currentTeam === parseInt(numberOfTeams) - 1 || 
                scores[currentTeam] > scores.reduce((max, score, idx) => 
                  idx !== currentTeam ? Math.max(max, score) : max, 0) + 
                  (4 * (parseInt(numberOfTeams) - currentTeam - 1))) && (
                <button
                  onClick={endGame}
                  className="p-3 text-lg font-bold bg-[#d32f2f] text-white rounded-lg hover:bg-[#b71c1c] transition-all duration-300 shadow-md"
                >
                  End Game
                </button>
              )}
            </div>
          </div>

          <div className={`round-end-screen ${gamePhase !== 'roundEnd' ? 'hidden' : ''}`}>
            <h2 className="text-3xl font-bold text-[#ff7043] text-center mb-6">
              Round Complete! 🎯
            </h2>
            <div className="space-y-8 text-center">
              <div className="team-summary p-6 bg-[#3d3d3d] rounded-lg">
                <h3 className="text-2xl font-bold mb-4">
                  {teamNames[currentTeam]}'s Performance 🌟
                </h3>
                <div className="text-4xl font-bold mb-2">
                  Score: {scores[currentTeam]} {scores[currentTeam] > 2 ? '🏆' : scores[currentTeam] > 0 ? '👏' : '💪'}
                </div>
                <div className="text-muted-foreground">
                  Keep up the great work! {scores[currentTeam] > 2 ? '🌟' : '✨'}
                </div>
              </div>

              <div className="scores-comparison grid grid-cols-2 gap-4">
                {teamNames.map((name, index) => (
                  <div key={index} className="p-4 bg-[#3d3d3d] rounded-lg">
                    <div className="text-lg font-bold mb-2">{name} 📊</div>
                    <div className="text-3xl font-bold text-[#ff7043]">{scores[index]}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                {/* Show End Game button if all teams have played or current team has unbeatable lead */}
                {(currentTeam === parseInt(numberOfTeams) - 1 || 
                  scores[currentTeam] > scores.reduce((max, score, idx) => 
                    idx !== currentTeam ? Math.max(max, score) : max, 0) + 
                    (4 * (parseInt(numberOfTeams) - currentTeam - 1))) && (
                  <button
                    onClick={endGame}
                    className="w-full p-3 text-lg font-bold bg-[#d32f2f] text-white rounded-lg hover:bg-[#b71c1c] transition-all duration-300 shadow-md mb-4"
                  >
                    End Game
                  </button>
                )}
                <button
                  onClick={continueToNextTeam}
                  className="w-full p-3 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md"
                >
                  {currentTeam === parseInt(numberOfTeams) -1 ? 'Another Round! 🔄' : `${teamNames[(currentTeam + 1) % parseInt(numberOfTeams)]}'s Turn! 🎮`}
                </button>
              </div>
            </div>
          </div>

          <div className={`final-scoreboard ${gamePhase === 'end' ? 'flex' : 'hidden'}`}>
            {gamePhase === 'end' && scores.some((score, index) => scores.filter((s, i) => i !== index).some(s => s === score)) && (
              <Confetti
                width={window.innerWidth}
                height={window.innerHeight}
                recycle={false}
                numberOfPieces={500}
                gravity={0.3}
              />
            )}
            <div className="space-y-8 text-center max-w-lg w-full px-4">
              <div className="winner-announcement">
                {scores.every((score) => score === scores[0]) ? (
                  <>It's a Tie! 🤝</>
                ) : (
                  <>{teamNames[scores.indexOf(Math.max(...scores))]} Wins! 🏆</>
                )}
              </div>
              
              <div className="team-summary p-6 bg-[#3d3d3d] rounded-lg mb-6">
                <div className="grid grid-cols-2 gap-6">
                  {teamNames.map((name, index) => (
                    <div key={index} className={`p-4 rounded-lg transition-all duration-300 ${scores[index] === Math.max(...scores) ? 'bg-[#ff7043]/20 scale-110' : 'bg-[#2d2d2d]'}`}>
                      <div className="text-lg font-bold mb-2">{name}</div>
                      <div className="text-4xl font-bold text-[#ff7043]">
                        {scores[index]}
                        {scores[index] === Math.max(...scores) && ' 👑'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xl text-[#ff7043]/80 mb-6">
                {scores.every((score) => score === scores[0]) ? (
                  <>Both teams showed amazing knowledge! 🌟</>
                ) : (
                  <>{teamNames[scores.indexOf(Math.max(...scores))]} dominated with {Math.max(...scores)} correct answers! 🎉</>
                )}
              </div>

              <button
                onClick={startNewGame}
                className="w-full p-4 text-lg font-bold bg-[#ff7043] text-white rounded-lg hover:bg-[#f4511e] transition-all duration-300 shadow-md hover:scale-105"
              >
                Play Again! 🎮
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

