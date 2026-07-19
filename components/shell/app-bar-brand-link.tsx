import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function AppBarBrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="MassageLab home"
      className={cn("ml-app-bar-brand", className)}
      data-testid="app-bar-brand"
    >
      <Image
        src="/brand/massagelab-wordmark-final-20260622.png"
        alt=""
        width={1518}
        height={593}
        className="ml-app-bar-brand-wordmark"
        sizes="144px"
        priority
      />
      <Image
        src="/brand/massagelab-mark-final-20260622.png"
        alt=""
        width={500}
        height={500}
        className="ml-app-bar-brand-mark"
        sizes="36px"
        priority
      />
    </Link>
  )
}
