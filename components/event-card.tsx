"use client"

import Link from "next/link"

export type EventDoc = {
  id: string
  title: string
  date: string
  time: string
  seats: number
  poster_url?: string
}

export default function EventCard({ event }: { event: EventDoc }) {
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col">
      <div className="relative h-48 w-full bg-muted flex items-center justify-center">
        {event.poster_url ? (
          <img src={event.poster_url || "/placeholder.svg"} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <img src="/short-film-poster.jpg" className="h-full w-full object-cover" alt={event.title} />
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-balance">{event.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {event.date} • {event.time}
        </p>
        <div className="mt-auto pt-4">
          <Link
            className="inline-block rounded bg-emerald-600 px-3 py-2 text-white text-sm"
            href={`/events/${event.id}`}
          >
            Book seat
          </Link>
        </div>
      </div>
    </div>
  )
}
