import emailjs from "@emailjs/browser"

/**
 * Sends a ticket email to the user with a QR code.
 * @param params Object containing user and ticket details.
 */
export async function sendTicketEmail(params: {
  to_name: string
  to_email: string
  event_title: string
  seat_no: string
  ticket_id: string
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

  if (!serviceId || !templateId || !publicKey) {
    console.error("EmailJS credentials missing from environment variables.")
    return { success: false, error: "Missing EmailJS credentials" }
  }

  // Using a QR code API to generate a URL for the email template
  // The value matches the format used in the app: SFC|ticket={ticketId}
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`SFC|ticket=${params.ticket_id}`)}`

  const templateParams = {
    to_name: params.to_name,
    to_email: params.to_email,
    event_title: params.event_title,
    seat_no: params.seat_no,
    ticket_id: params.ticket_id,
    qr_code_url: qrCodeUrl,
  }

  try {
    // Explicitly using the public key in the send method
    const response = await emailjs.send(serviceId, templateId, templateParams, publicKey)
    console.log("Email sent successfully:", response.status, response.text)
    return { success: true, response }
  } catch (error: any) {
    console.error("Failed to send email via EmailJS:", error)
    return { success: false, error: error?.text || error?.message || error }
  }
}
