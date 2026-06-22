import Link from "next/link"
import { BookOpen, Camera, Hammer, UserRound } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { SocialLinksSurface } from "@/components/social-links"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/about/derrick")

const introductionParagraphs = [
  "My name is Derrick Bowersock, LMT. I am a licensed massage therapist in Ohio, originally licensed in 2011, and based in Ashland.",
  "I have always been drawn to work that combines skill, creativity, and problem-solving. Massage therapy became one of the clearest expressions of that for me. It asks you to listen carefully, think critically, work with your hands, communicate clearly, and keep learning because every person brings something different to the table.",
  "I began my massage career in a franchise setting, then moved into independent practice as a sole proprietor inside a salon. Working independently shaped much of who I am as a therapist. It taught me how to build trust with clients, manage a practice, adapt when things change, and understand the profession from both the treatment room and the business side.",
] as const

const teachingParagraphs = [
  "Teaching and mentoring have also become important parts of my professional life. I have taught massage therapy and continue to help students with anatomy, physiology, massage theory, technique review, and MBLEx preparation. I enjoy helping people move from confusion to understanding, especially when they begin to realize that difficult material can make sense with the right explanation, the right tool, or the right way of looking at it.",
  "That pattern shows up in much of what I do. I like helping people understand things, fix problems, and feel more capable moving forward. Sometimes that happens during a massage session. Sometimes it happens while tutoring a student. Sometimes it happens while building, repairing, organizing, or creating something that makes a task easier.",
] as const

const craftParagraphs = [
  "Outside of massage and teaching, I tend to stay close to creative and hands-on work. Photography, music, sound, design, building, and repair all interest me because they involve noticing details, shaping an experience, and understanding how things fit together. Those interests influence how I think about massage as well. The atmosphere of a room, the pacing of a session, the way information is presented, and the feeling of a tool all matter.",
  "I care about massage as a profession because I know how much good work happens quietly in individual treatment rooms, classrooms, clinics, salons, and small practices. I also know how easy it is for therapists and students to feel isolated, under-supported, or overwhelmed by everything surrounding the work itself.",
  "MassageLab is one of the ways I am trying to respond to that.",
  "The project reflects my experience as a working therapist, educator, mentor, and practical problem-solver. My goal is to build resources that are useful, thoughtful, and grounded in real experience. I am still practicing, still learning, still teaching, and still building. MassageLab is part of that ongoing work.",
] as const

const bioCards = [
  {
    title: "Massage practice",
    description: "Licensed in Ohio since 2011, with experience in franchise and independent massage settings.",
    icon: UserRound,
  },
  {
    title: "Teaching and mentoring",
    description: "Supports students with anatomy, physiology, massage theory, technique review, and MBLEx preparation.",
    icon: BookOpen,
  },
  {
    title: "Creative problem-solving",
    description: "Builds tools around practical details: pacing, atmosphere, clarity, workflow, and confidence.",
    icon: Hammer,
  },
] as const

export default function AboutDerrickPage() {
  return (
    <AppPageShell width="prose" contentClassName="gap-6">
      <AppSurface className={appCalloutClassName} contentClassName="gap-5">
        <div>
          <p className="text-sm font-medium text-primary">About Derrick Bowersock, LMT</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Therapist, educator, mentor, and practical problem-solver</h1>
        </div>
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {introductionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-primary hover:bg-brand-orange-glow">
            <Link href="/about">About MassageLab</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>
      </AppSurface>

      <div className="grid gap-3 md:grid-cols-3">
        {bioCards.map((card) => {
          const Icon = card.icon
          return (
            <AppInset key={card.title} className="space-y-2 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Icon className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                <span>{card.title}</span>
              </div>
              <p>{card.description}</p>
            </AppInset>
          )
        })}
      </div>

      <AppSurface
        title="Teaching, tools, and confidence"
        description="Much of Derrick's work centers on helping people move from confusion to useful understanding."
        icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {teachingParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </AppSurface>

      <AppSurface
        title="Creative work and MassageLab"
        description="MassageLab connects clinical experience, classroom needs, and a hands-on approach to building better tools."
        icon={<Camera className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          {craftParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </AppSurface>

      <SocialLinksSurface
        title="Follow Derrick and MassageLab"
        description="Connect with Derrick's massage work and MassageLab project updates."
      />
    </AppPageShell>
  )
}
