"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { buildSupportMailtoUrl } from "@/lib/support-contact"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type SupportContactFormProps = {
  initialName: string
  initialContact: string
}

export function SupportContactForm({ initialName, initialContact }: SupportContactFormProps) {
  const [name, setName] = React.useState(initialName)
  const [contact, setContact] = React.useState(initialContact)
  const [topic, setTopic] = React.useState("")
  const [message, setMessage] = React.useState("")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.location.href = buildSupportMailtoUrl({ name, contact, topic, message })
  }

  return (
    <AppSurface
      title="Contact MassageLab"
      description={
        <>
          This opens your email app with the support request filled in. No message is uploaded to MassageLab from this form.
        </>
      }
    >
        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="support-name">Name</Label>
              <Input
                id="support-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-contact">Contact</Label>
              <Input
                id="support-contact"
                autoComplete="email"
                placeholder="Email or phone"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="support-topic">Topic</Label>
            <Input
              id="support-topic"
              placeholder="Account, calendar, notes, Chimer, or another topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              required
              rows={7}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-fit bg-primary hover:bg-brand-orange-glow">
            <Send className="mr-2 h-4 w-4" />
            Open Email
          </Button>
        </form>
    </AppSurface>
  )
}
