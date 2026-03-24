"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import TicketQR from "@/components/ticket-qr"
import { useAuthCtx } from "@/components/auth-context"

type Booking = {
  id: string
  eventId: string
  userId: string
  seatNo: string
  status?: string
  ticketId?: string
  createdAt?: string
}

export default function TicketPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = params?.eventId
  const { user, loading: authLoading } = useAuthCtx()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setError("Please sign in to view your ticket.")
      setLoading(false)
      return
    }

    async function fetchBooking() {
      try {
        const { data, error: bError } = await supabase
          .from("bookings")
          .select("*")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .single()
        
        if (bError) {
          if (bError.code === "PGRST116") {
            setError("No booking found for this event.")
          } else {
            throw bError
          }
        } else {
          setBooking({
            id: data.id,
            eventId: data.event_id,
            userId: data.user_id,
            seatNo: data.seat_no.toString(),
            status: data.status,
            ticketId: data.qr_code.split("ticket=")[1] || data.id,
            createdAt: data.created_at,
          })
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load ticket.")
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [eventId, user, authLoading])

  const ticketId = useMemo(() => {
    return booking?.ticketId || booking?.id || ""
  }, [booking])

  if (loading || authLoading) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Your Ticket</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Your Ticket</h1>
        <p className="text-sm text-red-600">{error}</p>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto p-6 flex flex-col items-center gap-4">
      <h1 className="text-xl font-semibold text-center text-balance">Your Ticket</h1>
      <TicketQR ticketId={ticketId} />
      <div className="text-sm text-center">
        <p className="text-muted-foreground">
          Seat: <span className="text-foreground font-medium">{booking?.seatNo}</span>
        </p>
        <p className="text-muted-foreground flex items-center justify-center gap-2">
          Ticket ID: <span className="text-foreground font-mono">{ticketId}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(ticketId)}
            className="rounded border px-2 py-1 text-xs hover:bg-accent"
            aria-label="Copy Ticket ID"
            title="Copy Ticket ID"
          >
            Copy
          </button>
        </p>
      </div>
    </main>
  )
}
