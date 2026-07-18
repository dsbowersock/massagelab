import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { getAppSidebarData } from "@/components/sidebar/sidebar"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import { SidebarCalendarProvider } from "@/components/sidebar/sidebar-calendar-provider"
import { SettingsProvider } from "@/components/providers/settings-provider"
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider"
import { PwaInstallProvider } from "@/components/providers/pwa-install-provider"
import { TherapistSettingsProvider } from "@/components/providers/therapist-settings-provider"
import { MusicProvider } from "@/components/providers/music-provider"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { createPublicPageMetadata, createSeoJsonLd } from "@/lib/seo"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })
const rootMetadata = createPublicPageMetadata("/")
delete rootMetadata.alternates

export const metadata: Metadata = {
  ...rootMetadata,
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
  const { user, canSyncAccountSettings, navigation } = await getAppSidebarData()
  const seoJsonLd = createSeoJsonLd()

  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body className={`${inter.className} h-full bg-background overflow-hidden`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoJsonLd) }}
        />
        <ServiceWorkerProvider />
        <PwaInstallProvider>
          <SettingsProvider syncEnabled={canSyncAccountSettings}>
            <TherapistSettingsProvider syncEnabled={canSyncAccountSettings}>
              <MusicProvider>
                <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden bg-background">
                  <SidebarCalendarProvider enabled={Boolean(user)}>
                    <AppSidebarClient user={user} navigation={navigation} />
                    <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
                      <main className="relative h-full min-w-0 overflow-hidden">
                        <LayoutWrapper user={user} navigation={navigation}>{children}</LayoutWrapper>
                      </main>
                    </SidebarInset>
                  </SidebarCalendarProvider>
                </SidebarProvider>
              </MusicProvider>
            </TherapistSettingsProvider>
          </SettingsProvider>
        </PwaInstallProvider>
      </body>
    </html>
  )
}
