import Link from "next/link"
import { Brain, HeartHandshake, Timer, UserRound } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { SocialLinksSurface } from "@/components/social-links"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/about")

const originParagraphs = [
  "MassageLab is being built from the perspective of a practicing massage therapist, educator, and small business owner.",
  "I have been a licensed massage therapist for 15 years. I started my career working for a franchise, then moved into independent practice as a sole proprietor inside a salon. That experience gave me the opportunity to grow my own practice, understand the business side of massage, and think deeply about what therapists actually need to succeed.",
  "Eventually, I began teaching massage therapy. Teaching came from my love of helping others reach their goals, build confidence, and think creatively. While working with students, I started to see gaps in massage education and professional practice. I also saw a need for modern tools that could help students and therapists learn more clearly, work more confidently, and build stronger practices.",
] as const

const toolParagraphs = [
  "MassageLab started with simple tools.",
  "The first was Chimer, a classroom timer designed so students could see a large clock on a screen, track how much time had passed, and understand how much time remained in a service. I later added interval sounds so students could learn pacing without constantly looking at the clock.",
  "Then came Anatomime, a game built around describing anatomical concepts without relying only on words. The goal is to help students make physical, practical connections with anatomy instead of only memorizing terms from a page.",
  "Over time, MassageLab has grown into a larger idea: one place where therapists, students, educators, and practice owners can access tools designed specifically for the massage profession.",
] as const

const professionParagraphs = [
  "There are already many helpful business tools available, including platforms for scheduling, payments, marketing, and client management. Many of them are useful, but they often feel like general business products that massage therapists can adapt to fit their needs. MassageLab is different because it is being built from inside the profession, by someone who uses these tools in real practice.",
  "The goal is to help independent massage therapists access the kinds of systems that larger franchises and corporate massage businesses already benefit from. Scheduling, documentation, education, marketing, organization, and client support should not only be available to large companies. Individual therapists and small practices deserve practical, affordable tools that help them do the work they love while also building sustainable careers.",
  "What you see on MassageLab today is only the beginning.",
  "The long-term vision includes educational tools, practice-building resources, SOAP note support, client-centered features, and secure systems for handling sensitive health-related information. Some of those features require careful planning, responsible privacy protections, and more advanced infrastructure before they can be released.",
  "Support from users helps make that growth possible.",
  "MassageLab exists to help massage therapists learn better, work smarter, support their clients more effectively, and build practices that are healthy for both the therapist and the people they serve.",
] as const

const toolCards = [
  {
    title: "Chimer",
    description: "A classroom and treatment-room timer for pacing massage sessions without constantly watching the clock.",
    icon: Timer,
  },
  {
    title: "Anatomime",
    description: "A physical anatomy game that helps students connect terms, concepts, movement, and body awareness.",
    icon: Brain,
  },
  {
    title: "Profession-first tools",
    description: "A growing toolkit shaped around massage education, independent practice, and small-business realities.",
    icon: HeartHandshake,
  },
] as const

export default function AboutPage() {
  return (
    <AppPageShell width="prose" contentClassName="gap-6">
      <AppSurface className={appCalloutClassName} contentClassName="gap-5">
        <div>
          <p className="text-sm font-medium text-primary">About MassageLab</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Built from inside the massage profession</h1>
        </div>
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {originParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/education/flashcards">Explore education tools</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/about/derrick">About Derrick</Link>
          </Button>
        </div>
      </AppSurface>

      <AppSurface
        title="How it started"
        description="The first MassageLab tools came from real classroom and practice needs."
        icon={<Timer className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {toolParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {toolCards.map((tool) => {
            const Icon = tool.icon
            return (
              <AppInset key={tool.title} className="space-y-2 p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Icon className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                  <span>{tool.title}</span>
                </div>
                <p>{tool.description}</p>
              </AppInset>
            )
          })}
        </div>
      </AppSurface>

      <AppSurface
        title="Why it matters"
        description="Independent therapists and small practices deserve tools that fit the way massage work actually happens."
        icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {professionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </AppSurface>

      <SocialLinksSurface
        title="Follow MassageLab"
        description="Follow the MassageLab project for tool updates, demos, and behind-the-scenes work."
        linkIds={["instagram", "youtube"]}
      />
    </AppPageShell>
  )
}
