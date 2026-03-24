"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Camera,
  CameraOff,
  Scan,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Mail,
  School,
  Calendar,
  MapPin,
  RefreshCw,
  Clock,
  QrCode,
} from "lucide-react"

import { supabase } from "@/lib/supabase"

// Supabase services
const registrationService = {
  getRegistrationByTicketId: async (ticketId: string) => {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        profiles:user_id (
          name,
          email,
          year,
          department
        )
      `)
      .or(`id.eq.${ticketId},qr_code.ilike.%ticket=${ticketId}%`)
      .single()
    
    if (error) {
      console.error("[v0] Error fetching registration:", error)
      return null
    }

    return {
      id: data.id,
      ticketId: ticketId,
      studentName: data.profiles?.name || "Unknown",
      studentEmail: data.profiles?.email || "Unknown",
      college: "SVCE",
      year: data.profiles?.year || "Unknown",
      eventId: data.event_id,
      status: data.checked_in_at ? "attended" : "verified",
      createdAt: { toDate: () => new Date(data.created_at) },
    }
  },
  markAttendance: async (id: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", id)
    
    if (error) throw error
  },
  verifyRegistration: async (id: string) => {
    // For now, verification is the same as markAttendance or just status update
    // If we have a 'status' field, we'd update it to 'verified'.
    // My schema has 'status' column in bookings.
    const { error } = await supabase
      .from("bookings")
      .update({ status: "verified" })
      .eq("id", id)
    
    if (error) throw error
  },
}

const eventService = {
  getEventById: async (id: string) => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single()
    
    if (error) {
      console.error("[v0] Error fetching event:", error)
      return null
    }

    return {
      id: data.id,
      title: data.title,
      date: { toDate: () => new Date(data.date) },
      venue: "Main Campus",
    }
  },
}

const qrService = {
  parseQRData: (data: string) => {
    if (data.includes("tickets=")) {
      const ticketIds = data.split("tickets=")[1].split(",")
      return { ticketId: ticketIds[0], allTicketIds: ticketIds }
    }
    if (data.includes("ticket=")) {
      const ticketId = data.split("ticket=")[1]
      return { ticketId, allTicketIds: [ticketId] }
    }
    if (data.includes("|")) {
      const parts = data.split("|")
      return { ticketId: parts[parts.length - 1] }
    }
    return { ticketId: data }
  },
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedData, setScannedData] = useState<any>(null)
  const [registration, setRegistration] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [manualTicketId, setManualTicketId] = useState("")
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const jsQRRef = useRef<any>(null)

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo(prev => [...prev.slice(-4), `[${timestamp}] ${message}`])
    console.log(`QR Scanner: ${message}`)
  }, [])

  useEffect(() => {
    // Load jsQR library dynamically
    const loadJsQR = async () => {
      try {
        const jsQRModule = await import("jsqr")
        jsQRRef.current = jsQRModule.default
        addDebugLog("jsQR library loaded successfully")
      } catch (error) {
        addDebugLog("Failed to load jsQR library")
        console.error("Failed to load jsQR:", error)
        toast.error("QR scanning library failed to load")
      }
    }

    loadJsQR()

    return () => {
      stopCamera()
    }
  }, [addDebugLog])

  const startCamera = async () => {
    try {
      addDebugLog("Requesting camera access...")
      setLoading(true)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)

        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              addDebugLog(`Video resolution: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`)
              resolve(null)
            }
          }
        })

        addDebugLog("Camera started successfully")
        scanForQRCode()
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      addDebugLog(`Camera error: ${error}`)
      toast.error("Failed to access camera. Please check permissions.")
    } finally {
      setLoading(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      addDebugLog("Camera stopped")
    }
    setIsScanning(false)
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }

  const scanForQRCode = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return

    // Set up scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
        addDebugLog("Video not ready for scanning")
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        
        // Use jsQR to detect QR codes
        if (jsQRRef.current) {
          try {
            const code = jsQRRef.current(
              imageData.data,
              imageData.width,
              imageData.height,
              {
                inversionAttempts: "dontInvert",
              }
            )

            if (code) {
              addDebugLog(`QR code detected: ${code.data.substring(0, 30)}...`)
              handleQRCodeDetected(code.data)
            }
          } catch (error) {
            addDebugLog(`QR scanning error: ${error}`)
          }
        } else {
          addDebugLog("jsQR library not loaded yet")
        }
      }
    }, 300)
  }

  const handleQRCodeDetected = async (qrData: string) => {
    try {
      setLoading(true)
      stopCamera()

      const parsedData = qrService.parseQRData(qrData)
      setScannedData(parsedData)

      // Load data for the first ticket (or we could show a list)
      await loadRegistrationData(parsedData.ticketId)
      
      if (parsedData.allTicketIds && parsedData.allTicketIds.length > 1) {
        toast.info(`Found ${parsedData.allTicketIds.length} tickets in this QR.`)
      }
    } catch (error) {
      console.error("Error processing QR code:", error)
      addDebugLog(`QR processing error: ${error}`)
      toast.error("Invalid QR code format")
    } finally {
      setLoading(false)
    }
  }

  const handleManualLookup = async () => {
    if (!manualTicketId.trim()) {
      toast.error("Please enter a ticket ID")
      return
    }

    try {
      setLoading(true)
      await loadRegistrationData(manualTicketId.trim())
    } catch (error) {
      console.error("Error looking up ticket:", error)
      addDebugLog(`Lookup error: ${error}`)
      toast.error("Failed to find ticket")
    } finally {
      setLoading(false)
    }
  }

  const loadRegistrationData = async (ticketId: string) => {
    try {
      addDebugLog(`Looking up ticket: ${ticketId}`)
      const regData = await registrationService.getRegistrationByTicketId(ticketId)

      if (!regData) {
        toast.error("Registration not found")
        return
      }

      setRegistration(regData)

      // Load event data
      const eventData = await eventService.getEventById(regData.eventId)
      setEvent(eventData)

      addDebugLog("Registration data loaded successfully")
      toast.success("Registration found!")
    } catch (error) {
      console.error("Error loading registration:", error)
      addDebugLog(`Registration load error: ${error}`)
      toast.error("Failed to load registration data")
    }
  }

  const handleMarkAttendance = async () => {
    if (!registration) return

    try {
      setLoading(true)
      await registrationService.markAttendance(registration.id)

      // Reload registration data
      await loadRegistrationData(registration.ticketId)

      toast.success("Attendance marked successfully!")
    } catch (error) {
      console.error("Error marking attendance:", error)
      addDebugLog(`Attendance error: ${error}`)
      toast.error("Failed to mark attendance")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyRegistration = async () => {
    if (!registration) return

    try {
      setLoading(true)
      await registrationService.verifyRegistration(registration.id)

      // Reload registration data
      await loadRegistrationData(registration.ticketId)

      toast.success("Registration verified successfully!")
    } catch (error) {
      console.error("Error verifying registration:", error)
      addDebugLog(`Verification error: ${error}`)
      toast.error("Failed to verify registration")
    } finally {
      setLoading(false)
    }
  }

  const resetScanner = () => {
    setScannedData(null)
    setRegistration(null)
    setEvent(null)
    setManualTicketId("")
    stopCamera()
    addDebugLog("Scanner reset")
  }

  const getStatusConfig = () => {
    if (!registration) return null

    const configs: any = {
      pending: {
        icon: Clock,
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        text: "Pending Verification",
      },
      verified: {
        icon: CheckCircle,
        color: "bg-green-100 text-green-800 border-green-200",
        text: "Verified",
      },
      rejected: {
        icon: XCircle,
        color: "bg-red-100 text-red-800 border-red-200",
        text: "Rejected",
      },
      attended: {
        icon: CheckCircle,
        color: "bg-blue-100 text-blue-800 border-blue-200",
        text: "Attended",
      },
    }

    return configs[registration.status] || configs.pending
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig?.icon || AlertCircle

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <QrCode className="h-8 w-8 text-blue-600" />
          QR Code Scanner
        </h1>
        <p className="text-gray-600 mt-2">Scan student tickets for event check-in</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Section */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 py-3">
            <CardTitle className="flex items-center gap-2 text-gray-900 text-lg">
              <Scan className="h-5 w-5 text-blue-600" />
              QR Code Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Camera View */}
            <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-64 bg-gray-100 object-cover ${isScanning ? "block" : "hidden"}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {!isScanning && (
                <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
                  <div className="text-center p-4">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Camera not active</p>
                    <p className="text-sm text-gray-500 mt-1">Click "Start Camera" to begin scanning</p>
                  </div>
                </div>
              )}

              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-blue-500 border-dashed rounded-lg w-48 h-48 animate-pulse"></div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button 
                  onClick={startCamera} 
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={stopCamera} variant="outline" className="flex-1 border-gray-300">
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              )}

              <Button onClick={resetScanner} variant="outline" className="border-gray-300">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Manual Entry */}
            <div className="space-y-3">
              <Label htmlFor="ticketId" className="text-gray-700">
                Manual Ticket ID Entry
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ticketId"
                  value={manualTicketId}
                  onChange={(e) => setManualTicketId(e.target.value)}
                  placeholder="Enter ticket ID"
                  className="border-gray-300 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleManualLookup()}
                />
                <Button 
                  onClick={handleManualLookup} 
                  disabled={loading || !manualTicketId.trim()} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? "Looking up..." : "Lookup"}
                </Button>
              </div>
            </div>

            {/* Debug Info */}
            <div className="bg-gray-50 border rounded p-3">
              <div className="font-medium text-gray-700 mb-1">Debug Info:</div>
              <div className="space-y-1 max-h-20 overflow-y-auto text-xs">
                {debugInfo.map((log, i) => (
                  <div key={i} className="font-mono text-gray-600 break-all">
                    {log}
                  </div>
                ))}
                {debugInfo.length === 0 && (
                  <div className="text-gray-500">No debug information yet</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 py-3">
            <CardTitle className="flex items-center gap-2 text-gray-900 text-lg">
              <User className="h-5 w-5 text-blue-600" />
              Registration Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading registration data...</p>
              </div>
            ) : registration && event ? (
              <div className="space-y-4">
                {/* Status */}
                <div className="text-center">
                  <Badge className={`${statusConfig?.color} border px-3 py-1 text-sm`}>
                    <StatusIcon className="h-4 w-4 mr-2" />
                    {statusConfig?.text}
                  </Badge>
                </div>

                <Separator />

                {/* Student Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Student Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium text-gray-900">{registration.studentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-900 break-all">{registration.studentEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <School className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-600">College:</span>
                      <span className="font-medium text-gray-900">{registration.college}</span>
                    </div>
                    {registration.year && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Year:</span>
                        <span className="font-medium text-gray-900">{registration.year}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Event Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Event Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{event.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-600">{formatDate(event.date.toDate())}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-600">{event.venue}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Registration Info */}
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    Ticket ID: <span className="font-mono text-gray-900">{registration.ticketId}</span>
                  </p>
                  <p>Registered: {formatDate(registration.createdAt.toDate())}</p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  {registration.status === "pending" && (
                    <Button
                      onClick={handleVerifyRegistration}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Registration
                    </Button>
                  )}

                  {registration.status === "verified" && (
                    <Button
                      onClick={handleMarkAttendance}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Attendance
                    </Button>
                  )}

                  {registration.status === "attended" && (
                    <div className="text-center py-2">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Already Attended
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Scan className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Registration Scanned</h3>
                <p className="text-gray-600">Scan a QR code or enter a ticket ID to view registration details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
