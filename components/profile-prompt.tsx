"use client"

import { useAuthCtx } from "./auth-context"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function ProfilePrompt() {
  const { user, isProfileComplete, loading } = useAuthCtx()

  if (loading || !user || isProfileComplete) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 sticky top-[65px] z-20">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          <span>Your profile is incomplete. Please add your phone number, year, and department.</span>
        </div>
        <Link 
          href="/profile" 
          className="rounded bg-amber-600 px-3 py-1 text-white text-xs font-semibold hover:bg-amber-700 transition-colors whitespace-nowrap"
        >
          Complete Profile
        </Link>
      </div>
    </div>
  )
}
