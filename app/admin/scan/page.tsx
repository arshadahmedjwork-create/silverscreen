import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import AdminScanClient from "@/components/admin-scan-client"

export default function ScanPage() {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">QR Scanner</h1>
        <div className="mt-4 min-h-64 rounded border bg-background">
          <AdminScanClient />
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
