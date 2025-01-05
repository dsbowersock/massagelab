import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
import Link from "next/link"
import { FileText, ClipboardList, Activity, FootprintsIcon as Walking, Ruler, TestTube } from 'lucide-react'

export default function NotesPage() {
  const noteTypes = [
    {
      title: "S.O.A.P. Notes",
      description: "Subjective, Objective, Assessment, and Plan documentation",
      icon: FileText,
      href: "/notes/soap"
    },
    {
      title: "Postural Assessment",
      description: "Document client posture observations and analyses",
      icon: ClipboardList,
      href: "/notes/posture"
    },
    {
      title: "Muscle Testing",
      description: "Record manual muscle testing results and findings",
      icon: Activity,
      href: "/notes/muscle-testing"
    },
    {
      title: "Gait Assessment",
      description: "Document walking pattern analysis and observations",
      icon: Walking,
      href: "/notes/gait"
    },
    {
      title: "R.O.M. Testing",
      description: "Record range of motion measurements and assessments",
      icon: Ruler,
      href: "/notes/rom"
    },
    {
      title: "Orthopedic Tests",
      description: "Document orthopedic test results and findings",
      icon: TestTube,
      href: "/notes/orthopedic"
    }
  ]

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeading>Note Taking Tools</PageHeading>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {noteTypes.map((note) => {
            const Icon = note.icon
            return (
              <Link key={note.href} href={note.href}>
                <Card className="h-full transition-all hover:bg-accent hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-[#ff7043]" />
                      <CardTitle>{note.title}</CardTitle>
                    </div>
                    <CardDescription>{note.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Click to create new {note.title.toLowerCase()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <Card className="bg-[#ff7043]/10 border-[#ff7043]">
          <CardHeader>
            <CardTitle>Important Notice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Please note that downloaded notes are stored locally on your device. You are responsible for ensuring HIPAA compliance and secure storage of any protected health information (PHI). Consider implementing appropriate security measures to protect downloaded files containing sensitive information.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

