"use client"

import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Cast, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'

export function Footer() {
  const { currentTrack, isPlaying, togglePlay } = useMusic()

  if (!currentTrack) return null

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-black/95">
      <div className="container flex h-16 items-center gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {currentTrack && (
            <>
              <div className="w-12 h-12 bg-muted rounded-sm overflow-hidden">
                <img 
                  src={currentTrack.image || "/placeholder.svg?height=48&width=48"} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white truncate">{currentTrack.title}</div>
                <div className="text-sm text-muted-foreground truncate">{currentTrack.artist}</div>
              </div>
              <div className="hidden md:block flex-1 h-8 bg-gradient-to-r from-[#ff7043]/20 to-transparent rounded" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <SkipBack className="h-4 w-4 text-white" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-9 w-9"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <SkipForward className="h-4 w-4 text-white" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Volume2 className="h-4 w-4 text-white" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Cast className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </footer>
  )
}

