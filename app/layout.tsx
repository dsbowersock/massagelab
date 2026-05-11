import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { AppSidebar } from "@/components/sidebar/sidebar"
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className={`${inter.className} h-full bg-background overflow-hidden`}>
        <SettingsProvider>
          <TherapistSettingsProvider>
            <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden bg-background">
              <AppSidebar />
              <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
                <main className="relative h-full min-w-0 overflow-hidden">
                  <LayoutWrapper>{children}</LayoutWrapper>
                </main>
              </SidebarInset>
            </SidebarProvider>
          </TherapistSettingsProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
