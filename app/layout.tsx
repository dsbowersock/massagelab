import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import { Sidebar } from "@/components/sidebar/sidebar"
import { Footer } from "@/components/footer"
import { MusicProvider } from "@/components/providers/music-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { SettingsProvider } from "@/components/providers/settings-provider"
import { TherapistSettingsProvider } from "@/components/providers/therapist-settings-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MassageLab",
  description: "Digital tools and resources for massage therapists and students",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="overflow-hidden">
      <body className={`${inter.className} bg-background overflow-hidden`}>
        <AuthProvider>
          <SettingsProvider>
            <TherapistSettingsProvider>
              <MusicProvider>
                <div className="relative h-[100dvh] flex flex-col overflow-hidden">
                  <div className="flex-1 flex overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 relative">
                      <LayoutWrapper>
                        {children}
                      </LayoutWrapper>
                    </main>
                  </div>
                  <Footer />
                </div>
              </MusicProvider>
            </TherapistSettingsProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

