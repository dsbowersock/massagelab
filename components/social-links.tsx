import type { LucideIcon } from "lucide-react"
import { AtSign, Facebook, Instagram, Youtube } from "lucide-react"
import { AppSurface, appInsetClassName } from "@/components/ui/app-surface"
import { MASSAGELAB_SOCIAL_LINKS } from "@/lib/social-links"
import { cn } from "@/lib/utils"

const socialIconById: Record<string, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
}

export function SocialLinksSurface({
  title = "Follow MassageLab",
  description = "Find MassageLab updates, demos, and community posts on social media.",
  linkIds,
}: {
  title?: string
  description?: string
  linkIds?: string[]
}) {
  const links = linkIds?.length
    ? MASSAGELAB_SOCIAL_LINKS.filter((link) => linkIds.includes(link.id))
    : MASSAGELAB_SOCIAL_LINKS

  return (
    <AppSurface
      title={title}
      description={description}
      icon={<AtSign className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((link) => {
          const Icon = socialIconById[link.id] ?? AtSign

          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="me noopener noreferrer"
              className={cn(
                appInsetClassName,
                "block p-3 text-sm transition hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Icon className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                <span>{link.label}</span>
              </span>
              <span className="mt-1 block text-sm text-primary">{link.handle}</span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">{link.description}</span>
            </a>
          )
        })}
      </div>
    </AppSurface>
  )
}
