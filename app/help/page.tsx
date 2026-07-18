import Link from "next/link"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/help")

const helpTopics = [
  {
    id: "account-access",
    title: "Account and access",
    body: "Create an account, verify your email, and sign in to save supported preferences and account activity.",
    links: [{ href: "/register", label: "Create Account" }, { href: "/login", label: "Log In" }],
  },
  {
    id: "installing",
    title: "Installing MassageLab",
    body: "Use Install MassageLab from the avatar menu when it appears. On iPhone or iPad in Safari, use Share, Add to Home Screen, then Add.",
    links: [],
  },
  {
    id: "clock-chimer",
    title: "Clock and Chimer",
    body: "Clock provides a standalone room clock. Chimer adds configurable session timing and alerts.",
    links: [{ href: "/clock", label: "Open Clock" }, { href: "/chimer", label: "Open Chimer" }],
  },
  {
    id: "music-backgrounds",
    title: "Music and backgrounds",
    body: "Use Music for generative stations and the available visual backgrounds. Background controls vary by the active tool.",
    links: [{ href: "/music", label: "Open Music" }],
  },
  {
    id: "premium-access",
    title: "Premium backgrounds and subscriptions",
    body: "Subscriptions can unlock supported premium backgrounds. Free background credits and individual background purchases are not available yet.",
    links: [{ href: "/pricing", label: "View Pricing" }, { href: "/account?tab=membership", label: "Account and Billing" }],
  },
  {
    id: "local-first-privacy",
    title: "Local-first privacy",
    body: "Professional records remain in the encrypted browser vault unless MassageLab explicitly says otherwise. Do not send client PHI through support messages.",
    links: [{ href: "/legal", label: "Privacy and Legal" }],
  },
] as const

export default function HelpPage() {
  return (
    <AppPageShell title="Help & FAQ" width="standard" contentClassName="gap-5">
      <header>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Help & FAQ</h1>
      </header>
      {helpTopics.map((topic) => (
        <AppSurface key={topic.id} id={topic.id} title={topic.title} description={topic.body}>
          {topic.links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topic.links.map((link) => (
                <Button key={link.href} asChild variant="secondary">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </AppSurface>
      ))}
      <AppSurface title="Send feedback or report a problem" description="Use the existing support flow for contact and optional privacy-safe diagnostics.">
        <Button asChild><Link href="/support">Send Feedback or Report a Problem</Link></Button>
      </AppSurface>
    </AppPageShell>
  )
}
