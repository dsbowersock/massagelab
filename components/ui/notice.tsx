import * as React from "react"
import {
  CircleCheck,
  CircleX,
  Inbox,
  Info,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Loader } from "@/components/ui/loader"

export type NoticeTone = "info" | "success" | "warning" | "error" | "sync" | "loading" | "empty"

const noticeVariants = cva(
  "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      tone: {
        info: "border-blue-500/35 bg-blue-500/10 text-blue-900 dark:text-blue-100",
        success: "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        error: "border-red-600/45 bg-red-500/15 text-red-950 dark:border-red-400/45 dark:bg-red-500/15 dark:text-red-100",
        sync: "border-violet-500/35 bg-violet-500/10 text-violet-900 dark:text-violet-100",
        loading: "border-primary/35 bg-primary/10 text-foreground",
        empty: "border-border/70 bg-muted/45 text-foreground",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  },
)

const noticeIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
  sync: RefreshCw,
  loading: LoaderCircle,
  empty: Inbox,
} satisfies Record<NoticeTone, typeof Info>

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  tone?: NoticeTone
}

export function Notice({
  title,
  description,
  tone = "info",
  className,
  role,
  ...props
}: NoticeProps) {
  const Icon = noticeIcons[tone]
  const resolvedRole = role ?? (tone === "error" || tone === "warning" ? "alert" : "status")

  return (
    <div className={cn(noticeVariants({ tone }), className)} role={resolvedRole} {...props}>
      {tone === "loading" ? (
        <Loader
          aria-hidden="true"
          label="Loading"
          variant="dither"
          size={20}
          color="currentColor"
          className="mt-0.5"
        />
      ) : <Icon className="mt-0.5 size-5" aria-hidden="true" />}
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {description ? <p className="mt-1 leading-5 opacity-80">{description}</p> : null}
      </div>
    </div>
  )
}

export { noticeVariants }
