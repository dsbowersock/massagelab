import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-[#2d2d2d] p-6 rounded-lg shadow-lg">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to MassageLab</h1>
            <p className="text-muted-foreground text-lg">
              Digital tools and resources for massage therapists and students
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card className="bg-card">
    <CardHeader>
      <CardTitle>Anatomime</CardTitle>
      <CardDescription>Learn muscle anatomy through an interactive team-based game</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="w-full bg-primary hover:bg-primary/90">
        <Link href="/anatomime">Play Now</Link>
      </Button>
    </CardContent>
  </Card>

  <Card className="bg-card">
    <CardHeader>
      <CardTitle>Chimer</CardTitle>
      <CardDescription>Customizable interval timer for massage sessions</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="w-full bg-primary hover:bg-primary/90">
        <Link href="/chimer">Start Timer</Link>
      </Button>
    </CardContent>
  </Card>

  <Card className="bg-card">
    <CardHeader>
      <CardTitle>Note Taking Tools</CardTitle>
      <CardDescription>Professional documentation tools for massage therapists</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="w-full bg-primary hover:bg-primary/90">
        <Link href="/notes">Create Note</Link>
      </Button>
    </CardContent>
  </Card>

  <Card className="bg-card">
    <CardHeader>
      <CardTitle>Calendar</CardTitle>
      <CardDescription>Schedule and manage your massage appointments</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild className="w-full bg-primary hover:bg-primary/90">
        <Link href="/calendar">View Calendar</Link>
      </Button>
    </CardContent>
  </Card>
</div>
        </div>
      </div>
    </div>
  )
}

