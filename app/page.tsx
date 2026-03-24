"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import EventCard, { type EventDoc } from "@/components/event-card"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"

export default function HomePage() {
  const [events, setEvents] = useState<EventDoc[]>([])

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true })
      
      if (error) {
        console.error("[v0] Error fetching events:", error)
      } else {
        setEvents(data as EventDoc[])
      }
    }

    fetchEvents()

    // Real-time subscription
    const channel = supabase
      .channel("events_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchEvents()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-balance">Upcoming Events</h1>
        <p className="text-sm text-muted-foreground mt-1">Book a seat for a Short Film Club screening.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
