"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, FileText, Home, Settings, Timer, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

interface NavProps extends React.HTMLAttributes<HTMLElement> {
  isCollapsed: boolean
  position: "left" | "right" | "top" | "bottom"
}

const mainRoutes = [
  {
    href: "/",
    label: "Home",
    icon: Home,
  },
  {
    href: "/chimer",
    label: "Chimer",
    icon: Timer,
  },
  {
    href: "/notes",
    label: "Notes",
    icon: FileText,
  },
  {
    href: "/anatomime",
    label: "Anatomime",
    icon: Brain,
  },
]

const bottomRoutes = [
  {
    href: "/account",
    label: "Account",
    icon: UserRound,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
]

export function Nav({ className, isCollapsed, position, ...props }: NavProps) {
  const pathname = usePathname() ?? ""
  const isHorizontal = position === "top" || position === "bottom"

  const NavLink = ({ route }: { route: (typeof mainRoutes)[number] }) => {
    const active = route.href === "/" ? pathname === "/" : pathname.startsWith(route.href)

    return (
      <Link
        href={route.href}
        className={cn(
          buttonVariants({ variant: active ? "default" : "ghost", size: "lg" }),
          "h-12",
          isCollapsed ? "w-12 px-0" : "w-full justify-start",
          active && "bg-[#ff7043] hover:bg-[#f4511e]",
        )}
      >
        <route.icon className="h-4 w-4" />
        {!isCollapsed && <span className="ml-3">{route.label}</span>}
      </Link>
    )
  }

  const navClasses = cn(
    "flex gap-2 h-full w-full",
    {
      "flex-col justify-between": !isCollapsed || !isHorizontal,
      "flex-row items-center justify-between": isHorizontal && isCollapsed,
    },
    className,
  )

  const routeContainerClasses = cn("flex gap-2 min-w-fit items-center", {
    "flex-col": !isCollapsed || !isHorizontal,
    "flex-row": isHorizontal && isCollapsed,
  })

  return (
    <nav className={navClasses} {...props}>
      <div className={routeContainerClasses}>
        {mainRoutes.map((route) => (
          <NavLink key={route.href} route={route} />
        ))}
      </div>
      <div className={cn(routeContainerClasses, !isHorizontal && "mt-auto")}>
        {bottomRoutes.map((route) => (
          <NavLink key={route.href} route={route} />
        ))}
      </div>
    </nav>
  )
}
