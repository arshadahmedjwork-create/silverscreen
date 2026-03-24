# Short Film Club – Movie Booking

This application has been migrated from Firebase to Supabase.

## Environment Variables

Client-side environment variables required:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key.

## Database Schema (PostgreSQL)

- **profiles**: User information (`id`, `email`, `name`, `phone_number`, `year`, `department`, `role`).
- **events**: Event details (`id`, `title`, `date`, `time`, `seats`, `poster_url`).
- **bookings**: Ticket registrations (`id`, `event_id`, `user_id`, `seat_no`, `qr_code`, `status`, `checked_in_at`).
- **seat_locks**: Temporary seat locks for the booking process.

## Authentication

- Supports Email/Password and Google Sign-In.
- Open to all email addresses (no domain restriction).
- Admin access is managed via the `role` column in the `profiles` table.

## Notes

- Atomic seat locking and booking are handled via Supabase RPC functions (`try_lock_seat`, `confirm_booking_with_lock`).
- Real-time updates are implemented using Supabase Channels.
