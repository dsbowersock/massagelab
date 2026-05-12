import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { getAppSidebarData } from "@/components/sidebar/sidebar"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import { SettingsProvider } from "@/components/providers/settings-provider"
import { TherapistSettingsProvider } from "@/components/providers/therapist-settings-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MassageLab",
  description: "Private-alpha tools for massage therapists and students",
  applicationName: "MassageLab",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MassageLab",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, calendarContext } = await getAppSidebarData()

  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body className={`${inter.className} h-full bg-background overflow-hidden`}>
        <SettingsProvider>
          <TherapistSettingsProvider>
            <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden bg-background">
              <AppSidebarClient user={user} calendarContext={calendarContext} />
              <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
                <main className="relative h-full min-w-0 overflow-hidden">
                  <LayoutWrapper user={user}>{children}</LayoutWrapper>
                </main>
              </SidebarInset>
            </SidebarProvider>
          </TherapistSettingsProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
