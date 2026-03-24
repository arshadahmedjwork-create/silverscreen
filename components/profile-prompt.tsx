"use client"

import { useAuthCtx } from "./auth-context"
import Link from "next/link"
import { AlertCircle, UserCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

export default function ProfilePrompt() {
  const { user, isProfileComplete, loading } = useAuthCtx()
  const pathname = usePathname()

  // Only show if logged in, profile is incomplete, and NOT on the profile page itself
  if (loading || !user || isProfileComplete || pathname === "/profile") return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="bg-amber-500 p-6 flex flex-col items-center gap-3 text-white">
            <UserCircle className="h-16 w-16" />
            <h2 className="text-2xl font-bold tracking-tight">Complete Your Profile</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100 italic text-amber-900 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>To provide a better experience and verify your tickets, we need your phone number, year of study, and department.</p>
            </div>
            
            <Link 
              href="/profile" 
              className="flex items-center justify-center rounded-xl bg-amber-600 py-4 text-white font-bold text-lg hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-200"
            >
              Finish Setup Now
            </Link>
            
            <p className="text-center text-xs text-gray-400">
              This only takes a minute and is required for booking.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
