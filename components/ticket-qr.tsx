"use client"

import { useEffect } from "react"
import { QRCodeCanvas } from "qrcode.react"

type TicketQRProps = {
  ticketId: string
  size?: number
}

/**
 * Renders a QR from the ticketId directly (no Storage).
 * Also caches the last ticket locally as a convenience.
 */
export default function TicketQR({ ticketId, size = 224 }: TicketQRProps) {
  const value = `SFC|ticket=${ticketId}`

  useEffect(() => {
    try {
      localStorage.setItem("sfc:lastTicketId", ticketId)
    } catch {}
  }, [ticketId])

  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeCanvas value={value} size={size} includeMargin />
      <p className="text-xs text-muted-foreground text-center">
        Show this QR at entry. It encodes only your ticket id.
      </p>
    </div>
  )
}
