"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { app } from "@/lib/firebase"
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore"

const QrScanner = dynamic(
  async () => {
    // Try multiple common exports to avoid dynamic import issues
    const mod = await import("@yudiel/react-qr-scanner")
    return mod.QRScanner || mod.default
  },
  { ssr: false, loading: () => <p className="p-4">Starting camera…</p> },
)

type BookingWithUser = {
  id: string
  eventId: string
  userId: string
  seatNo: string
  ticketId?: string
  name?: string
  email?: string
}

export default function AdminScan2Page() {
  const [result, setResult] = useState<BookingWithUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)

  const handleDecode = async (text: string) => {
    setError(null)
    try {
      // Accept either "SFC|ticket=..." or a raw id
      let ticketId = text
      const pref = "SFC|ticket="
      if (text.startsWith(pref)) ticketId = text.slice(pref.length)

      const db = getFirestore(app)

      // First, try to find by the ticketId field
      let bookingDocId: string | null = null
      let data: any | null = null
      const q = query(collection(db, "bookings"), where("ticketId", "==", ticketId))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const d = snap.docs[0]
        bookingDocId = d.id
        data = d.data()
      } else {
        // Fallback: treat the scanned value as the booking document id
        const cand = await getDoc(doc(db, "bookings", ticketId))
        if (cand.exists()) {
          bookingDocId = cand.id
          data = cand.data()
        }
      }

      if (!bookingDocId || !data) {
        setResult(null)
        setError("No booking found for this ticket.")
        return
      }

      // Fetch user profile
      let name: string | undefined
      let email: string | undefined
      if (data.userId) {
        const u = await getDoc(doc(db, "users", data.userId))
        if (u.exists()) {
          const ud = u.data() as any
          name = ud.name
          email = ud.email
        }
      }

      setResult({
        id: bookingDocId,
        eventId: data.eventId,
        userId: data.userId,
        seatNo: data.seatNo,
        ticketId: data.ticketId,
        name,
        email,
      })
    } catch (e: any) {
      setError(e?.message || "Failed to read QR.")
    }
  }

  const checkIn = async () => {
    if (!result) return
    setCheckingIn(true)
    try {
      const db = getFirestore(app)
      await updateDoc(doc(db, "bookings", result.id), {
        status: "checked_in",
        checkedInAt: serverTimestamp(),
      })
      setResult({ ...result /* reflect status locally */ })
    } catch (e: any) {
      setError(e?.message || "Failed to check in.")
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <main className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Admin Scanner</h1>
      <div className="rounded-md overflow-hidden border">
        {/* Camera scanner */}
        {/* @ts-expect-error - dynamic module type */}
        <QrScanner onDecode={handleDecode} onError={(err: any) => setError(err?.message || "Camera error")} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="border rounded-md p-4 space-y-2">
          <p className="text-sm">
            Ticket: <span className="font-mono">{result.ticketId || result.id}</span>
          </p>
          <p className="text-sm">
            Event: <span className="font-medium">{result.eventId}</span>
          </p>
          <p className="text-sm">
            Seat: <span className="font-medium">{result.seatNo}</span>
          </p>
          <p className="text-sm">
            Name: <span className="font-medium">{result.name || "—"}</span>
          </p>
          <p className="text-sm">
            Email: <span className="font-medium">{result.email || "—"}</span>
          </p>
          <button
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm"
            onClick={checkIn}
            disabled={checkingIn}
          >
            {checkingIn ? "Checking in…" : "Mark as Checked-in"}
          </button>
        </div>
      )}
    </main>
  )
}
