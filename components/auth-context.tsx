"use client"

import type React from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

type Role = "" | "user" | "admin"
type AuthCtx = {
  user: User | null
  role: Role | null
  loading: boolean
  isProfileComplete: boolean
}
const Ctx = createContext<AuthCtx>({
  user: null,
  role: null,
  loading: true,
  isProfileComplete: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProfileComplete, setIsProfileComplete] = useState(true)

  useEffect(() => {
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      setUser(u)

      if (u) {
        // Fetch profile to get role and completeness
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, phone_number, year, department")
          .eq("id", u.id)
          .single()

        if (error) {
          console.error("[v0] Error fetching profile:", error)
          setRole("")
          setIsProfileComplete(false)
        } else {
          setRole((profile?.role as Role) ?? "")
          const complete = !!(profile?.phone_number && profile?.year && profile?.department)
          setIsProfileComplete(complete)
        }
      } else {
        setRole(null)
        setIsProfileComplete(true)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({ user, role, loading, isProfileComplete }),
    [user, role, loading, isProfileComplete],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuthCtx() {
  return useContext(Ctx)
}
