import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Sidebar } from "@/components/sidebar/sidebar"
import { SettingsProvider } from "@/components/providers/settings-provider"
import { TherapistSettingsProvider } from "@/components/providers/therapist-settings-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MassageLab",
  description: "Private-alpha tools for massage therapists and students",
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="overflow-hidden">
      <body className={`${inter.className} bg-background overflow-hidden`}>
        <SettingsProvider>
          <TherapistSettingsProvider>
            <div className="relative flex h-[100dvh] flex-col overflow-hidden">
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="relative flex-1">
                  <LayoutWrapper>{children}</LayoutWrapper>
                </main>
              </div>
            </div>
          </TherapistSettingsProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
