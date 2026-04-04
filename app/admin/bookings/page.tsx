"use client"

import { useEffect, useState } from "react"
import { useAuthCtx } from "@/components/auth-context"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import { Check, X, ImageIcon, Loader2, ExternalLink, Mail, User, Sofa, Calendar } from "lucide-react"
import { sendTicketEmail } from "@/lib/emailjs"

type BookingWithProfile = {
  id: string
  event_id: string
  user_id: string
  seat_no: number
  qr_code: string
  payment_proof_url: string
  payment_status: string
  status: string
  created_at: string
  profiles: {
    name: string
    email: string
  }
  events: {
    title: string
  }
}

export default function AdminBookingsPage() {
  const { role } = useAuthCtx()
  const [bookings, setBookings] = useState<BookingWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    if (role !== "admin") return

    async function fetchBookings() {
      setLoading(true)
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles:user_id (name, email),
          events:event_id (title)
        `)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Fetch bookings error:", error)
      } else {
        setBookings(data as any[] || [])
      }
      setLoading(false)
    }

    fetchBookings()

    const channel = supabase
      .channel("admin_bookings_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchBookings())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [role])

  if (role !== "admin") {
    return (
      <main className="min-h-screen bg-slate-50">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
          <p className="text-slate-600">You do not have administrative privileges to view this page.</p>
        </section>
        <SiteFooter />
      </main>
    )
  }

  async function handleApprove(booking: BookingWithProfile) {
    if (processingId) return
    setProcessingId(booking.id)

    try {
      // 1. Update Supabase status
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          payment_status: "booked",
          status: "booked"
        })
        .eq("id", booking.id)

      if (updateError) throw updateError

      // 2. Send Email via EmailJS
      const ticketId = booking.qr_code?.split("ticket=")[1] || booking.id
      const emailResult = await sendTicketEmail({
        to_name: booking.profiles?.name || "Customer",
        to_email: booking.profiles?.email,
        event_title: booking.events?.title || "Event",
        seat_no: booking.seat_no.toString(),
        ticket_id: ticketId,
      })

      if (!emailResult.success) {
        alert("Booking approved, but failed to send email. Check console for details.")
      } else {
        alert("Booking approved and ticket sent successfully!")
      }

    } catch (error: any) {
      alert(error.message || "Failed to approve booking.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(booking: BookingWithProfile) {
    if (processingId) return
    const reason = prompt("Optional: Reason for rejection (e.g., Invalid Screenshot)")
    setProcessingId(booking.id)

    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          payment_status: "rejected",
          status: "rejected"
        })
        .eq("id", booking.id)

      if (error) throw error
      alert("Booking rejected.")
    } catch (error: any) {
      alert(error.message || "Failed to reject booking.")
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked':
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Approved</span>
      case 'rejected':
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Rejected</span>
      default:
        return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Pending</span>
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader />
      
      <section className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Manage Bookings</h1>
            <p className="text-slate-500 font-medium">Verify payments and issue tickets</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{bookings.length} Total Bookings</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
             <p className="text-slate-500 font-bold animate-pulse">Scanning Bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
             <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Calendar className="h-8 w-8 text-slate-300" />
             </div>
             <p className="text-slate-400 font-bold">No bookings found in the system.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {bookings.map((booking) => (
              <div 
                key={booking.id} 
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group overflow-hidden relative"
              >
                {/* Background ID Watermark */}
                <span className="absolute top-4 right-4 text-[60px] font-black text-slate-50/50 select-none pointer-events-none group-hover:text-slate-100/50 transition-colors">
                  {booking.seat_no}
                </span>

                <div className="flex flex-col md:flex-row gap-6 relative">
                  {/* Payment Screenshot Section */}
                  <div className="shrink-0">
                    <div className="relative w-full md:w-32 h-48 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 group-hover:border-emerald-200 transition-colors">
                      {booking.payment_proof_url ? (
                        <>
                          <img 
                            src={booking.payment_proof_url} 
                            alt="Payment Proof" 
                            className="w-full h-full object-cover cursor-zoom-in hover:scale-110 transition-transform duration-500"
                            onClick={() => setSelectedImage(booking.payment_proof_url)}
                          />
                          <button 
                            onClick={() => setSelectedImage(booking.payment_proof_url)}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/20 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                          <ImageIcon className="h-8 w-8 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-tight">Proof Missing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booking Details Section */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-start justify-between mb-2">
                       <div className="min-w-0">
                          <h3 className="text-xl font-bold text-slate-900 truncate flex items-center gap-2">
                            <span className="bg-slate-900 text-white h-7 w-7 rounded-lg flex items-center justify-center text-xs ml-0 mr-1 shrink-0">{booking.seat_no}</span>
                            {booking.profiles?.name || "Unknown User"}
                          </h3>
                          <div className="flex items-center gap-2 text-slate-500 mt-1">
                             <Mail className="h-3 w-3 shrink-0" />
                             <span className="text-sm font-medium truncate">{booking.profiles?.email || "No email provided"}</span>
                          </div>
                       </div>
                       <div className="shrink-0">{getStatusBadge(booking.payment_status)}</div>
                    </div>

                    <div className="space-y-3 mt-4 py-4 border-y border-slate-100">
                       <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <Calendar className="h-3.5 w-3.5" /> Event
                          </div>
                          <span className="font-bold text-slate-700 truncate ml-4">{booking.events?.title || "N/A"}</span>
                       </div>
                       <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <User className="h-3.5 w-3.5" /> User ID
                          </div>
                          <span className="font-mono text-xs bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-500 truncate ml-4 md:max-w-[120px]">{booking.user_id}</span>
                       </div>
                       <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <Sofa className="h-3.5 w-3.5" /> Seat Label
                          </div>
                          <span className="font-bold text-slate-900 underline decoration-slate-200 underline-offset-2">Seat {booking.seat_no}</span>
                       </div>
                    </div>

                    <div className="mt-auto pt-6 flex flex-wrap gap-3">
                      {(booking.payment_status === 'pending' || !booking.payment_status) ? (
                        <>
                          <button
                            disabled={!!processingId}
                            onClick={() => handleApprove(booking)}
                            className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200/50 disabled:opacity-50"
                          >
                            {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Approve
                          </button>
                          <button
                            disabled={!!processingId}
                            onClick={() => handleReject(booking)}
                            className="flex-1 min-w-[120px] bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-100 font-black text-sm uppercase tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                            {processingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin text-rose-600" /> : <X className="h-4 w-4" />}
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="w-full text-center py-2 px-4 rounded-xl bg-slate-50 border border-slate-100">
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Decision Finalized</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Full Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl w-full h-full flex flex-col items-center justify-center gap-4">
             <img 
               src={selectedImage} 
               alt="Enlarged Proof" 
               className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
             />
             <button 
               onClick={() => setSelectedImage(null)}
               className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-3 rounded-full border border-white/20 backdrop-blur-md transition-all shadow-xl"
             >
               Close View
             </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  )
}
