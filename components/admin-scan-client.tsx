"use client"

import { useAuthCtx } from "@/components/auth-context"
import QrScanner from "@/components/qr-scanner"

export default function AdminScanClient() {
  const { role } = useAuthCtx()

  // When auth is still initializing, role can be empty/undefined.
  if (role === undefined || role === null || role === "") {
    return <p className="mt-4 text-sm text-muted-foreground">Checking admin access…</p>
  }

  const allowed = role === "admin"
  if (!allowed) {
    return <p className="mt-4">Access denied. Admins only.</p>
  }

  return <QrScanner />
}
