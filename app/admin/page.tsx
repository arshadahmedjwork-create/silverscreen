"use client"

import { useEffect, useState } from "react"
import { useAuthCtx } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { Check, X, ExternalLink, ImageIcon } from "lucide-react"

export default function AdminPage() {
  const { role } = useAuthCtx()

  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [poster, setPoster] = useState<File | null>(null)
  const [seats, setSeats] = useState(60)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>("")
  const [usersById, setUsersById] = useState<Record<string, { name?: string; email?: string }>>({})
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    if (role !== "admin") return

    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false })
      
      if (error) {
        console.error("[v0] Admin events fetch error:", error)
      } else {
        setEvents(data || [])
        if (!selectedEvent && data && data.length > 0) setSelectedEvent(data[0].id)
      }
    }

    fetchEvents()

    const channel = supabase
      .channel("admin_events_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => fetchEvents())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [role, selectedEvent])

  useEffect(() => {
    if (role !== "admin" || !selectedEvent) return

    async function fetchBookings() {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles:user_id (id, name, email)
        `)
        .eq("event_id", selectedEvent)
      
      if (error) {
        console.error("[v0] Admin bookings fetch error:", error)
      } else {
        setBookings(data || [])
        
        // Update usersById cache
        const newUsers: Record<string, { name?: string; email?: string }> = {}
        data?.forEach((b: any) => {
          if (b.profiles) {
            newUsers[b.profiles.id] = { name: b.profiles.name, email: b.profiles.email }
          }
        })
        setUsersById((prev) => ({ ...prev, ...newUsers }))
      }
    }

    fetchBookings()

    const channel = supabase
      .channel(`admin_bookings_${selectedEvent}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `event_id=eq.${selectedEvent}` }, () => fetchBookings())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedEvent, role])

  if (role !== "admin") {
    return (
      <main>
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-4 py-8">
          <p>Access denied. Admins only.</p>
        </section>
        <SiteFooter />
      </main>
    )
  }

  async function updateBookingStatus(bookingId: string, status: string) {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ 
          payment_status: status,
          status: status === "booked" ? "booked" : "rejected"
        })
        .eq("id", bookingId)
      
      if (error) throw error
      alert(`Booking ${status}.`)
    } catch (e: any) {
      alert(e.message || "Failed to update booking.")
    }
  }

  async function createEvent() {
    try {
      let posterUrl = ""
      if (poster) {
        if (!poster.type || !poster.type.startsWith("image/")) {
          alert("Please select an image file.")
          return
        }
        if (poster.size > 10 * 1024 * 1024) {
          alert("Poster must be 10MB or smaller.")
          return
        }

        const fileName = `${Date.now()}_${poster.name}`
        const { data, error } = await supabase.storage
          .from("posters")
          .upload(fileName, poster, {
            contentType: poster.type || "image/jpeg",
            cacheControl: "31536000",
          })
        
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from("posters").getPublicUrl(fileName)
        posterUrl = publicUrl
      }

      const { error } = await supabase.from("events").insert({
        title,
        date,
        time,
        seats: Math.min(Math.max(seats, 1), 60),
        poster_url: posterUrl,
      })

      if (error) throw error

      setTitle("")
      setDate("")
      setTime("")
      setPoster(null)
      setSeats(60)
      alert("Event created.")
    } catch (e: any) {
      alert(e.message || "Failed to create event.")
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* New Bookings Column */}
          <div className="rounded-3xl border-2 border-emerald-100 bg-emerald-50/30 p-6 flex flex-col justify-between hover:shadow-lg transition-all group">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                 <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bookings</h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">Verify payment screenshots and approve ticket requests manually.</p>
            </div>
            <Link 
              href="/admin/bookings" 
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-center py-3 rounded-xl transition-colors shadow-xl shadow-slate-200"
            >
              Verify Payments
            </Link>
          </div>

          <div className="rounded border p-4">
            <h2 className="font-medium">Create Event</h2>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <input
                className="rounded border px-3 py-2"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={1}
                max={60}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              />
              <input
                className="rounded border px-3 py-2"
                type="file"
                accept="image/*"
                onChange={(e) => setPoster(e.target.files?.[0] || null)}
              />
              <button onClick={createEvent} className="rounded bg-emerald-600 px-3 py-2 text-white">
                Create
              </button>
            </div>
          </div>

          <div className="rounded border p-4">
            <h2 className="font-medium">Registrations</h2>
            <div className="mt-3">
              <select
                className="rounded border px-3 py-2"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 max-h-80 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Seat</th>
                    <th className="text-left p-2">User</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Payment</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-2 font-medium">{b.seat_no}</td>
                      <td className="p-2">{b.profiles?.name || "-"}</td>
                      <td className="p-2 text-xs">{b.profiles?.email || "-"}</td>
                      <td className="p-2">
                        {b.payment_proof_url ? (
                          <a 
                            href={b.payment_proof_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <ImageIcon className="h-3 w-3" />
                            View Proof
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No proof</span>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                          b.payment_status === 'booked' ? 'bg-emerald-100 text-emerald-700' :
                          b.payment_status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {b.payment_status || b.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {(b.payment_status === 'pending' || !b.payment_status) && (
                            <>
                              <button 
                                onClick={() => updateBookingStatus(b.id, "booked")}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Accept"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => updateBookingStatus(b.id, "rejected")}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td className="p-2" colSpan={5}>
                        No bookings yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Link href="/admin/scan" className="mt-4 inline-block text-sm underline">
              Open QR Scanner
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
