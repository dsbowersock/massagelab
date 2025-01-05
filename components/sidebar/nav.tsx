"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Home, Brain, Timer, Settings, FileText, User, Calendar } from 'lucide-react'
import { useSession, signIn } from "next-auth/react"

interface NavProps extends React.HTMLAttributes<HTMLElement> {
  isCollapsed: boolean
  position: "left" | "right" | "top" | "bottom"
}

export function Nav({ className, isCollapsed, position, ...props }: NavProps) {
  const pathname = usePathname()

  const mainRoutes = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/"
    },
    {
      href: "/anatomime",
      label: "Anatomime",
      icon: Brain,
      active: pathname === "/anatomime"
    },
    {
      href: "/chimer",
      label: "Chimer",
      icon: Timer,
      active: pathname === "/chimer"
    },
    {
      href: "/notes",
      label: "Notes",
      icon: FileText,
      active: pathname.startsWith("/notes")
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: Calendar,
      active: pathname === "/calendar"
    },
  ]

  const bottomRoutes = [
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      active: pathname === "/settings"
    },
    {
      href: "#",
      label: "Sign In",
      icon: User,
      active: false,
      onClick: () => signIn()
    }
  ]

  const isHorizontal = position === "top" || position === "bottom"

  const NavLink = ({ route }: { route: typeof mainRoutes[0] & { onClick?: () => void } }) => (
    <Link
      href={route.href}
      onClick={route.onClick}
      className={cn(
        buttonVariants({ variant: route.active ? "default" : "ghost", size: "lg" }),
        "h-12",
        isCollapsed ? "w-12 px-0" : "w-full justify-start",
        route.active && "bg-[#ff7043] hover:bg-[#f4511e]"
      )}
    >
      <route.icon className="h-4 w-4" />
      {!isCollapsed && <span className="ml-3">{route.label}</span>}
    </Link>
  )

  const navClasses = cn(
    "flex gap-2 h-full w-full",
    {
      "flex-col justify-between": !isCollapsed || !isHorizontal,
      "flex-row items-center justify-between": isHorizontal && isCollapsed,
    },
    className
  )

  const routeContainerClasses = cn("flex gap-2 min-w-fit items-center",
    {
      "flex-col": !isCollapsed || !isHorizontal,
      "flex-row": isHorizontal && isCollapsed,
    }
  )

  return (
    <nav className={navClasses} {...props}>
      <div className={routeContainerClasses}>
        {mainRoutes.map((route) => (
          <NavLink key={route.href} route={route} />
        ))}
      </div>
      <div className={cn(
        routeContainerClasses,
        !isHorizontal && "mt-auto"
      )}>
        {bottomRoutes.map((route) => (
          <NavLink key={route.href} route={route} />
        ))}
      </div>
    </nav>
  )
}

