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
    <main className="min-h-screen bg-background">
      <SiteHeader />
      
      {!event ? (
        <section className="mx-auto max-w-5xl px-4 py-8">
          <p>Loading…</p>
        </section>
      ) : (
        <>
          {/* Hero Banner Section */}
          <div className="relative w-full h-[300px] md:h-[450px] overflow-hidden">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
              style={{ backgroundImage: `url(${event.poster_url || "/short-film-poster.jpg"})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-12">
              <div className="flex flex-col md:flex-row items-end gap-6">
                <div className="hidden md:block w-48 h-72 rounded-xl overflow-hidden border-4 border-background shadow-2xl shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img
                    src={event.poster_url || "/short-film-poster.jpg"}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live Screening
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-2xl">
                    {event.title}
                  </h1>
                  <p className="text-lg text-white/80 font-medium tracking-tight">
                    {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} • {event.time}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section className="mx-auto max-w-5xl px-4 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Event Info - Mobile Only Poster */}
              <div className="lg:col-span-4 space-y-8">
                <div className="md:hidden relative w-full aspect-[2/3] rounded-2xl overflow-hidden border bg-muted shadow-xl">
                  <img
                    src={event.poster_url || "/short-film-poster.jpg"}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                
                <div className="space-y-6">
                  <div className="rounded-2xl border p-6 bg-card/50 backdrop-blur-sm space-y-4">
                    <h2 className="font-bold text-xl tracking-tight">Details</h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-semibold">{event.date}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Door Opens</span>
                        <span className="font-semibold">{event.time}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Venue Capacity</span>
                        <span className="font-semibold">{event.seats} Seats</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-6 bg-card/50 backdrop-blur-sm space-y-4">
                    <h2 className="font-bold text-xl tracking-tight">Status</h2>
                    <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-bold uppercase tracking-widest">Ongoing Booking</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Area */}
              <div className="lg:col-span-8">
                <div className="space-y-8">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black tracking-tight">Select Your Seat</h2>
                    <p className="text-muted-foreground font-medium">Choose from our luxury seating arrangement for the best club experience.</p>
                  </div>
                  
                  {!user ? (
                    <div className="rounded-2xl border-2 border-dashed border-emerald-100 p-8 bg-emerald-50/10 text-center space-y-4">
                      <p className="text-lg font-medium text-slate-900">Sign in to reserve your spot at the Short Film Club.</p>
                      <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-8 text-sm font-bold text-white shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95">
                        Login Now
                      </Link>
                    </div>
                  ) : (
                    <div className="relative rounded-3xl border bg-card/30 backdrop-blur-xl p-2 md:p-8 shadow-2xl">
                      <SeatMap 
                        eventId={event.id} 
                        eventTitle={event.title} 
                        capacity={event.seats}
                        posterUrl={event.poster_url}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
      <SiteFooter />
    </main>
  )
}
