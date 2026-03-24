"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import SeatMap from "@/components/seat-map"
import { useAuthCtx } from "@/components/auth-context"
import Link from "next/link"
import type { EventDoc } from "@/components/event-card"

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const { user } = useAuthCtx()
  const [event, setEvent] = useState<(EventDoc & { description?: string }) | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single()
      
      if (error) {
        console.error("[v0] Error loading event:", error)
      } else {
        setEvent(data as EventDoc)
      }
    }
    load()
  }, [id])

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-8">
        {!event ? (
          <p>Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-2">
              <div className="relative w-full h-72 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                {event.poster_url ? (
                  <img
                    src={event.poster_url || "/placeholder.svg"}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img src="/short-film-poster.jpg" alt={event.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Date: {event.date}</p>
                <p>Time: {event.time}</p>
              </div>
            </div>
            <div className="md:col-span-3">
              <h1 className="text-2xl font-semibold">{event.title}</h1>
              {!user ? (
                <div className="mt-4 rounded border p-4">
                  <p className="text-sm">Please log in to book a seat.</p>
                  <Link href="/login" className="mt-3 inline-block rounded bg-emerald-600 px-3 py-2 text-white text-sm">
                    Login
                  </Link>
                </div>
              ) : (
                <div className="mt-4">
                  <SeatMap eventId={event.id} eventTitle={event.title} capacity={event.seats} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  )
}
