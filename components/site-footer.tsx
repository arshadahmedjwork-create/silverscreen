export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-center gap-3">
        {/* MUST use Source URL (full logo on light background) */}
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shortfilm_logo.jpg-HcRTfp7s6KvvoU4lRLc0VUGc8drSpe.jpeg"
          width={40}
          height={40}
          alt="Short Film Club logo"
        />
        <p className="text-sm text-muted-foreground">Short Film Club</p>
      </div>
    </footer>
  )
}
