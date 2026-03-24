import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { AuthProvider } from "@/components/auth-context"
import ProfilePrompt from "@/components/profile-prompt"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Short Film Club | Movie Booking App",
  description: "Book your seats for the latest short film screenings and cinematic events.",
  icons: {
    icon: "/assets/shortfilm_logo_nobackground.png",
    apple: "/assets/shortfilm_logo_nobackground.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <AuthProvider>
            <ProfilePrompt />
            {children}
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  )
}
