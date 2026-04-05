"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuthCtx } from "./auth-context"
import QRCode from "qrcode"
import { Clock, Upload, Check, X, CreditCard } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type SeatStatus = "available" | "locked" | "booked" | "selected"

const IMG_AVAILABLE =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/seat_avilable-aZyxcKGaqayJLInKoAhsXl1P8eYFry.png"
const IMG_LOCKED =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/seat_temp_locked-Fg8JKTfXLdSc8VQIlIog3O3k1ZPouu.png"
const IMG_BOOKED =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/seat_booked-tVj09CJadBF5weHgmg2hwqaLCX2MMG.png"
const IMG_SELECTED =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/seat_selected-lITnwxSqkdfP2ECilyzkhv48BjK5FT.png"

function numbers(total: number) {
  return Array.from({ length: total }, (_, i) => i + 1)
}

function generateTicketId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export default function SeatMap({
  eventId,
  capacity = 70,
  eventTitle,
}: {
  eventId: string
  capacity: number
  eventTitle: string
}) {
  const { user, isProfileComplete } = useAuthCtx()
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [lastClickedSeat, setLastClickedSeat] = useState<number | null>(null)
  const [booked, setBooked] = useState<Set<number>>(new Set())
  const [locked, setLocked] = useState<Set<number>>(new Set())
  const [myBookingSeats, setMyBookingSeats] = useState<number[]>([])
  const [confirming, setConfirming] = useState(false)
  const [ticketDataUrl, setTicketDataUrl] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes payment
  const [selectionTimeLeft, setSelectionTimeLeft] = useState(120) // 2 minutes selection
  const [isSelectionActive, setIsSelectionActive] = useState(false)
  const lockTimer = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const tokenRef = useRef<string | null>(null)
  const selectedSeatsRef = useRef<number[]>([])

  useEffect(() => {
    selectedSeatsRef.current = selectedSeats
  }, [selectedSeats])

  async function setQrFromTicketIds(ticketIds: string[]) {
    if (!ticketIds.length) return
    try {
      const payload = `SFC|tickets=${ticketIds.join(",")}`
      const dataUrl = await QRCode.toDataURL(payload)
      setTicketDataUrl(dataUrl)
    } catch {
      setTicketDataUrl(null)
    }
  }

  // Fetch bookings and locks
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    
    async function fetchData() {
      // Fetch bookings
      const { data: bData, error: bError } = await supabase
        .from("bookings")
        .select("seat_no, user_id, id, qr_code")
        .eq("event_id", eventId)

      if (!bError) {
        const set = new Set<number>()
        const mySeats: number[] = []
        const myTicketIds: string[] = []
        bData.forEach((b) => {
          set.add(b.seat_no)
          if (b.user_id === user?.id) {
            mySeats.push(b.seat_no)
            const ticketId = b.qr_code?.split("ticket=")[1] || b.id
            myTicketIds.push(ticketId)
          }
        })
        setBooked(set)
        setMyBookingSeats(mySeats)
        if (myTicketIds.length) setQrFromTicketIds(myTicketIds)
      }

      // Fetch locks
      const { data: lData, error: lError } = await supabase
        .from("seat_locks")
        .select("seat_no, expires_at")
        .eq("event_id", eventId)
        .gt("expires_at", new Date().toISOString())

      if (!lError) {
        const set = new Set<number>()
        lData.forEach((l) => set.add(l.seat_no))
        setLocked(set)
      }
    }

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(fetchData, 300)
    }

    fetchData()

    // Real-time subscriptions with delta updates for performance
    const bookingsChannel = supabase
      .channel(`bookings_${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `event_id=eq.${eventId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const b = payload.new as any
          setBooked(prev => new Set([...prev, b.seat_no]))
          if (b.user_id === user?.id) {
            debouncedFetch() // For user-specific complex updates (QR etc), fetch is safer but debounced
          }
        } else if (payload.eventType === "DELETE") {
          const b = payload.old as any
          setBooked(prev => {
            const next = new Set(prev)
            next.delete(b.seat_no)
            return next
          })
          debouncedFetch()
        } else {
          debouncedFetch()
        }
      })
      .subscribe()

    const locksChannel = supabase
      .channel(`locks_${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seat_locks", filter: `event_id=eq.${eventId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const l = payload.new as any
          setLocked(prev => new Set([...prev, l.seat_no]))
        } else if (payload.eventType === "DELETE") {
          const l = payload.old as any
          setLocked(prev => {
            const next = new Set(prev)
            next.delete(l.seat_no)
            return next
          })
        } else {
          debouncedFetch()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(bookingsChannel)
      supabase.removeChannel(locksChannel)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [eventId, user?.id])

  // Helper to get seat labels (e.g. A1, B2)
  const getSeatLabel = (n: number) => {
    const row = String.fromCharCode(65 + Math.floor((n - 1) / 10))
    const col = ((n - 1) % 10) + 1
    return `${row}${col}`
  }

  const seats = useMemo(() => numbers(Math.min(capacity, 70)), [capacity])

  const seatState = useCallback((seatNo: number): SeatStatus => {
    if (booked.has(seatNo)) return "booked"
    if (selectedSeats.includes(seatNo)) return "selected"
    if (locked.has(seatNo)) return "locked"
    return "available"
  }, [booked, selectedSeats, locked])

  const tryLock = useCallback(async (seatNo: number) => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    try {
      const { data: success, error } = await supabase.rpc("try_lock_seat", {
        p_event_id: eventId,
        p_seat_no: seatNo,
        p_user_id: user?.id,
        p_expires_at: expiresAt
      })
      if (error) throw error
      if (success) {
        setSelectedSeats(prev => [...prev, seatNo])
        return true
      }
      return false
    } catch (e: any) {
      console.error("Lock error:", e)
      return false
    }
  }, [eventId, user?.id])

  const releaseLock = useCallback(async (seatNo: number) => {
    if (!user) return
    try {
      await supabase
        .from("seat_locks")
        .delete()
        .eq("event_id", eventId)
        .eq("seat_no", seatNo)
        .eq("user_id", user.id)
      setSelectedSeats(prev => prev.filter(s => s !== seatNo))
      if (lastClickedSeat === seatNo) setLastClickedSeat(null)
    } catch { }
  }, [user, eventId, lastClickedSeat])

  const releaseAllLocks = useCallback(async () => {
    if (!user || selectedSeats.length === 0) return
    try {
      await supabase
        .from("seat_locks")
        .delete()
        .eq("event_id", eventId)
        .in("seat_no", selectedSeats)
        .eq("user_id", user.id)
    } catch { }
    setSelectedSeats([])
    setLastClickedSeat(null)
  }, [user, selectedSeats, eventId])

  const handleSeatClick = useCallback(async (seatNo: number) => {
    if (!user || myBookingSeats.length > 0) return

    // If clicking a selected seat, deselect it and its lock
    if (selectedSeats.includes(seatNo)) {
      await releaseLock(seatNo)
      return
    }

    let seatsToLock = [seatNo]

    // Range selection logic
    if (lastClickedSeat !== null) {
      const rowStart = Math.floor((lastClickedSeat - 1) / 10)
      const rowEnd = Math.floor((seatNo - 1) / 10)

      if (rowStart === rowEnd) {
        const start = Math.min(lastClickedSeat, seatNo)
        const end = Math.max(lastClickedSeat, seatNo)
        const range: number[] = []
        for (let i = start; i <= end; i++) {
          if (!booked.has(i) && !locked.has(i) && !selectedSeats.includes(i)) {
            range.push(i)
          }
        }
        if (range.length > 1) {
          seatsToLock = range
        }
      }
    }

    // Enforce 5 seat limit
    const totalAfterAdd = selectedSeats.length + seatsToLock.length
    if (totalAfterAdd > 5) {
      // Just take the first few that fit
      const spaceLeft = 5 - selectedSeats.length
      if (spaceLeft <= 0) {
        alert("You can only book up to 5 seats.")
        return
      }
      seatsToLock = seatsToLock.slice(0, spaceLeft)
    }

    // Try locking each seat
    const results = await Promise.all(seatsToLock.map(s => tryLock(s)))
    const actuallyLocked = seatsToLock.filter((_, i) => results[i])

    if (actuallyLocked.length > 0) {
      // If we just locked a range, don't make the last one 'sticky' for the next range
      if (seatsToLock.length > 1) {
        setLastClickedSeat(null)
      } else {
        setLastClickedSeat(seatNo)
      }

      if (!isSelectionActive) {
        setIsSelectionActive(true)
        setSelectionTimeLeft(120)
      }
    }
  }, [user, myBookingSeats.length, selectedSeats, lastClickedSeat, booked, locked, isSelectionActive, tryLock, releaseLock])

  useEffect(() => {
    if (isSelectionActive && !showPaymentModal && selectionTimeLeft > 0) {
      selectionTimerRef.current = setInterval(() => {
        setSelectionTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (selectionTimeLeft <= 0 && isSelectionActive && !showPaymentModal) {
      setIsSelectionActive(false)
      releaseAllLocks()
      alert("Selection timer expired. Seats released.")
    }
    return () => {
      if (selectionTimerRef.current) clearInterval(selectionTimerRef.current)
    }
  }, [isSelectionActive, showPaymentModal, selectionTimeLeft])

  useEffect(() => {
    if (showPaymentModal && timeLeft > 0) {
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft <= 0 && showPaymentModal) {
      setShowPaymentModal(false)
      releaseAllLocks()
      alert("Payment timer expired. Seats have been released.")
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [showPaymentModal, timeLeft])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      tokenRef.current = session?.access_token || null
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || null
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleUnload = () => {
      const seats = selectedSeatsRef.current
      if (user && seats.length > 0 && tokenRef.current) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/seat_locks?event_id=eq.${eventId}&user_id=eq.${user.id}`
        fetch(url, {
          method: "DELETE",
          headers: {
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Authorization": `Bearer ${tokenRef.current}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          keepalive: true,
        })
      }
    }

    window.addEventListener("beforeunload", handleUnload)
    return () => {
      window.removeEventListener("beforeunload", handleUnload)
    }
  }, [user, eventId])

  // Explicit unmount cleanup
  useEffect(() => {
    return () => {
      if (user && selectedSeatsRef.current.length > 0) {
        // We use a separate async call since we can't easily wait here
        supabase
          .from("seat_locks")
          .delete()
          .eq("event_id", eventId)
          .in("seat_no", selectedSeatsRef.current)
          .eq("user_id", user.id)
          .then()
      }
    }
  }, [user, eventId])

  useEffect(() => {
    return () => {
      // Standard cleanup on unmount handled above
    }
  }, [])

  async function handleBookClick() {
    if (!user || selectedSeats.length === 0) return
    setTimeLeft(300)
    setShowPaymentModal(true)
    // Selection timer is effectively paused by dependency [showPaymentModal] in useEffect
  }

  async function confirmBooking() {
    if (!user || selectedSeats.length === 0 || !paymentProof) {
      alert("Please upload payment proof.")
      return
    }
    setPaymentLoading(true)

    try {
      // 1. Upload Payment Proof
      const fileName = `${Date.now()}_proof_${user.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from("payments")
        .upload(fileName, paymentProof)

      if (uploadError) throw uploadError
      const { data: { publicUrl: proofUrl } } = supabase.storage.from("payments").getPublicUrl(fileName)

      const successfulSeats: number[] = []
      const ticketIds: string[] = []

      // 2. Create Bookings with pending status
      for (const seatNo of [...selectedSeats].sort((a, b) => a - b)) {
        const newTicketId = generateTicketId()
        // We use a direct insert instead of confirm_booking_with_lock if we want to include custom fields
        // Or we update the RPC. To keep it simple, let's use the RPC but then update the row.
        // Actually, let's just do a manual transaction-like flow or update bookings after confirmation.

        const { data: success, error: rpcError } = await supabase.rpc("confirm_booking_with_lock", {
          p_event_id: eventId,
          p_user_id: user.id,
          p_seat_no: seatNo,
          p_ticket_id: newTicketId
        })

        if (!rpcError && success) {
          // Update the booking with payment details
          await supabase
            .from("bookings")
            .update({
              payment_proof_url: proofUrl,
              payment_status: "pending",
              status: "pending" // Overriding the default 'booked'
            })
            .eq("event_id", eventId)
            .eq("seat_no", seatNo)

          successfulSeats.push(seatNo)
          ticketIds.push(newTicketId)
        }
      }

      if (successfulSeats.length > 0) {
        setMyBookingSeats(prev => [...prev, ...successfulSeats])
        setSelectedSeats([])
        setLastClickedSeat(null)
        setIsSelectionActive(false)
        setShowPaymentModal(false)
        alert("Booking submitted! Please wait for admin approval.")
      }
    } catch (e: any) {
      alert(e.message || "Could not confirm booking.")
    } finally {
      setPaymentLoading(false)
    }
  }

  const legend = (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <LegendItem img={IMG_AVAILABLE} label="Available" />
      <LegendItem img={IMG_LOCKED} label="Temporarily locked" />
      <LegendItem img={IMG_BOOKED} label="Booked" />
      <LegendItem img={IMG_SELECTED} label="Selected" />
    </div>
  )

  return (
    <div>
      {legend}
      <div className="rounded-lg border p-4">
        <div className="space-y-4">
          {chunk(seats, 10).map((row, idx) => (
            <div key={idx} className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                {row.slice(0, 5).map((n) => (
                  <Seat key={n} seatNo={n} label={getSeatLabel(n)} state={seatState(n)} onClick={() => handleSeatClick(n)} />
                ))}
              </div>
              <div className="w-8" aria-hidden />
              <div className="flex items-center gap-2">
                {row.slice(5, 10).map((n) => (
                  <Seat key={n} seatNo={n} label={getSeatLabel(n)} state={seatState(n)} onClick={() => handleSeatClick(n)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Screen Indicator */}
        <div className="mt-12 flex flex-col items-center gap-2 overflow-hidden px-10">
          <div className="h-1.5 w-full max-w-[400px] rounded-full bg-gradient-to-r from-transparent via-gray-300 to-transparent shadow-[0_0_20px_rgba(0,0,0,0.1)]" />
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Screen this way</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <p className="text-sm font-medium mr-2 self-center">Selected Seats:</p>
          {selectedSeats.sort().map(s => (
            <span key={s} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-100">
              {getSeatLabel(s)}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-emerald-900" 
                onClick={() => releaseLock(s)} 
              />
            </span>
          ))}
          {selectedSeats.length === 0 && <span className="text-sm text-gray-400 font-normal">None selected (Max 5)</span>}
          {selectedSeats.length > 0 && selectedSeats.length < 5 && (
            <span className="text-[10px] text-gray-400 self-center uppercase font-bold tracking-tight">
              {5 - selectedSeats.length} more allowed
            </span>
          )}
        </div>
        
        {isSelectionActive && !showPaymentModal && selectedSeats.length > 0 && (
          <div className="flex items-center gap-2 text-amber-600 font-mono text-sm font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm animate-pulse">
            <Clock className="h-4 w-4" />
            Selection Time: {Math.floor(selectionTimeLeft / 60)}:{(selectionTimeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          disabled={selectedSeats.length === 0 || confirming || myBookingSeats.length > 0}
          onClick={handleBookClick}
          className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {confirming ? "Confirming…" : `Confirm ${selectedSeats.length} Seat(s)`}
        </button>
        {selectedSeats.length > 0 && (
          <button onClick={() => releaseAllLocks()} className="rounded border px-4 py-2">
            Cancel
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  Payment Page
                </h3>
                <div className="flex items-center gap-2 text-amber-600 font-mono text-sm font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  <Clock className="h-4 w-4" />
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-gray-600 text-sm">Total Amount (₹40 x {selectedSeats.length})</p>
                  <p className="text-3xl font-black text-gray-900">₹{selectedSeats.length * 40}</p>
                </div>

                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Scan to Pay via UPI</p>
                  <UpiQR amount={selectedSeats.length * 40} />
                  <a
                    href={`upi://pay?pa=manickthoure1970@okhdfcbank&pn=Payment&cu=INR&am=${selectedSeats.length * 40}`}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    Open UPI App
                  </a>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 block">Upload Payment Screenshot</label>
                  <div className="relative border-2 border-dashed border-gray-200 rounded-lg p-4 transition-colors hover:border-emerald-400 group cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      {paymentProof ? (
                        <>
                          <Check className="h-8 w-8 text-emerald-500" />
                          <p className="text-xs font-medium text-emerald-600">{paymentProof.name}</p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 group-hover:text-emerald-500" />
                          <p className="text-xs text-gray-500">Click or drag image here</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    disabled={paymentLoading}
                    onClick={() => {
                      setShowPaymentModal(false)
                      setPaymentProof(null)
                    }}
                    className="flex-1 rounded-lg border py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={paymentLoading || !paymentProof}
                    onClick={confirmBooking}
                    className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {paymentLoading ? "Confirming..." : "Paid"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {myBookingSeats.length > 0 && (
        <div className="mt-6 rounded border p-4">
          <p className="font-medium">Your bookings</p>
          <p className="text-sm text-muted-foreground">
            {eventTitle} • Seats {myBookingSeats.map(getSeatLabel).sort().join(", ")}
          </p>
          {ticketDataUrl && (
            <div className="mt-4">
              <img src={ticketDataUrl || "/placeholder.svg"} alt="QR Code ticket" className="h-48 w-48" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function chunk<T>(arr: T[], size: number) {
  const res: T[][] = []
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
  return res
}

const Seat = memo(({
  seatNo,
  label,
  state,
  onClick,
}: {
  seatNo: number
  label: string
  state: SeatStatus
  onClick: (s: number) => void
}) => {
  const src =
    state === "booked"
      ? IMG_BOOKED
      : state === "locked"
        ? IMG_LOCKED
        : state === "selected"
          ? IMG_SELECTED
          : IMG_AVAILABLE
  const clickable = state === "available" || state === "selected"
  return (
    <button
      onClick={clickable ? () => onClick(seatNo) : undefined}
      className="relative h-10 w-10 group"
      aria-label={`Seat ${label} ${state}`}
      disabled={!clickable}
      title={`Seat ${label}`}
    >
      <img src={src || "/placeholder.svg"} alt={`Seat ${label}`} className="h-10 w-10 object-contain" />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 pointer-events-none">
        {label}
      </span>
    </button>
  )
})

const LegendItem = memo(({ img, label }: { img: string; label: string }) => {
  return (
    <div className="flex items-center gap-2">
      <img src={img || "/placeholder.svg"} alt={label} className="h-6 w-6 object-contain" />
      <span className="text-sm">{label}</span>
    </div>
  )
})

function UpiQR({ amount }: { amount: number }) {
  const [url, setUrl] = useState("")
  useEffect(() => {
    const upiLink = `upi://pay?pa=manickthoure1970@okhdfcbank&pn=Payment&cu=INR&am=${amount}`
    QRCode.toDataURL(upiLink).then(setUrl)
  }, [amount])
  return url ? <img src={url} alt="UPI QR Code" className="h-32 w-32 shadow-md border rounded" /> : null
}
