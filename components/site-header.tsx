"use client"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuthCtx } from "./auth-context"

export default function SiteHeader() {
  const { user, role } = useAuthCtx()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/assets/shortfilm_logo_nobackground.png"
            alt="Short Film Club Logo"
            width={40}
            height={40}
            className="object-contain"
          />
          <span className="font-bold text-xl tracking-tight">Short Film Club</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-sm hover:underline">
            Events
          </Link>
          {role === "admin" && (
            <>
              <Link href="/admin" className="text-sm hover:underline">
                Admin
              </Link>
              <Link href="/admin/scan" className="text-sm hover:underline">
                Scan
              </Link>
            </>
          )}
          {!user ? (
            <Link href="/login" className="rounded bg-emerald-600 px-3 py-1.5 text-white text-sm">
              Login
            </Link>
          ) : (
            <>
              <Link href="/profile" className="text-sm hover:underline">
                Profile
              </Link>
              <button className="rounded border px-3 py-1.5 text-sm" onClick={() => supabase.auth.signOut()}>
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
