"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuthCtx } from "@/components/auth-context"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"

const DEPARTMENTS = [
  "B.E Civil Engineering",
  "B.E Computer Science and Engineering",
  "B.E Electronics and Communication Engineering",
  "B.E Electrical and Electronics Engineering",
  "B.E Mechanical Engineering",
  "B.E Mechanical and Automation Engineering",
  "B.E.Mechanical Engineering(Automobile)",
  "B.Tech. Artificial Intelligence and Data Sciences",
  "B.Tech Biotechnology",
  "B.Tech Chemical Engineering",
  "B.Tech Information Technology",
  "Postgraduate Programs",
  "M.E Communication Systems",
  "M.E Computer Science and Engineering",
  "M.E. Construction Engineering and Management",
  "M.E. Industrial Automation and Robotics",
  "M.E Power Electronics & Drives",
  "M.Tech Biotechnology",
  "M.Tech Chemical Engineering",
  "M.Tech Cyber Forensics and Information Security"
]

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Staff"]

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuthCtx()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    year: "",
    department: ""
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single()
      
      if (data) {
        setFormData({
          name: data.name || "",
          phone_number: data.phone_number || "",
          year: data.year || "",
          department: data.department || ""
        })
      }
      setLoading(false)
    }
    loadProfile()
  }, [user, authLoading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone_number: formData.phone_number,
          year: formData.year,
          department: formData.department,
          updated_at: new Date().toISOString()
        })
        .eq("id", user?.id)
      
      if (error) throw error
      alert("Profile updated successfully!")
      router.push("/")
      // Force refresh auth context (simple way is window reload or just redirect)
      window.location.href = "/"
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) return <p className="p-8 text-center text-sm">Loading profile…</p>

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-semibold">Complete Your Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Please provide your details to continue.</p>
        
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">Full Name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone Number</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="e.g. 9876543210"
              required
              type="tel"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Year</label>
            <select
              className="w-full rounded border px-3 py-2 bg-background"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              required
            >
              <option value="">Select Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Department</label>
            <select
              className="w-full rounded border px-3 py-2 bg-background"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <button disabled={saving} className="mt-2 rounded bg-emerald-600 px-3 py-2 text-white">
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </section>
      <SiteFooter />
    </main>
  )
}
