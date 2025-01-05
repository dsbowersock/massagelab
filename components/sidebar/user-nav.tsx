"use client"

import { Button } from "@/components/ui/button"
import { User, LogOut } from 'lucide-react'
import { cn } from "@/lib/utils"
import { useSession, signIn, signOut } from "next-auth/react"

interface UserNavProps {
  isCollapsed: boolean
}

export function UserNav({ isCollapsed }: UserNavProps) {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <Button 
        variant="ghost" 
        className={cn(
          "w-full justify-start h-12",
          isCollapsed && "justify-center"
        )}
        disabled
      >
        <User className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
        {!isCollapsed && "Loading..."}
      </Button>
    )
  }

  if (!session) {
    return null // Don't render anything if there's no session
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={cn(
        "flex items-center gap-2",
        isCollapsed ? "justify-center px-2 py-2" : "px-4 py-2"
      )}>
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <User className="h-8 w-8" />
        )}
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="font-medium">{session.user?.name}</span>
            <span className="text-xs text-muted-foreground">{session.user?.email}</span>
          </div>
        )}
      </div>
      <Button 
        variant="ghost" 
        className={cn(
          "w-full justify-start h-12",
          isCollapsed && "justify-center"
        )}
        onClick={() => signOut()}
      >
        <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
        {!isCollapsed && "Sign Out"}
      </Button>
    </div>
  )
}

