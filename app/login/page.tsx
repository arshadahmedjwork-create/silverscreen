"use client"

import { type FormEvent, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        })
        if (signUpError) throw signUpError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }
      router.push("/")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/v1/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-semibold">{mode === "signup" ? "Create account" : "Login"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in with any email address.</p>
        
        <div className="mt-6 flex flex-col gap-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="rounded bg-emerald-600 px-3 py-2 text-white">
              {loading ? "Please wait…" : mode === "signup" ? "Sign up" : "Login"}
            </button>
          </form>
        </div>
        <button className="mt-4 text-sm underline" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Have an account? Login" : "New here? Create an account"}
        </button>
      </section>
      <SiteFooter />
    </main>
  )
}
