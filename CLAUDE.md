# Snoek Webapp

Coaching accountability platform — coaches set goals with coachees and keep them accountable between sessions.

## Cross-Platform

This webapp shares a Supabase backend with the React Native mobile app at `../../../Snoek/Mobile/`. When making changes to database schema, RLS policies, Supabase Edge Functions, or table structures, always consider the impact on the mobile app.

### Shared resources
- **Supabase project**: `tpgvaijfwbbnsiqdyqmk.supabase.co`
- **Shared tables**: profiles, clients, client_members, yearly_goals, quarterly_goals, quarterly_key_results, weekly_values, metrics, metric_values, conversations, messages, message_key_results, meetings, meeting_documents, automations, invitations, push_tokens
- **Auth**: Both apps use Supabase Auth. Webapp uses magic link; mobile uses email/password.

### Key differences between apps
- Mobile stores weekly values with `week` (number 1-13 per quarter); webapp uses `week_start` (date)
- Mobile uses Firebase Cloud Messaging for push notifications (Edge Function `send-message-push`)
- Mobile has a subset of webapp features: goals viewing/updating, 1:1 chat, push notifications

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui (Radix UI primitives)
- Supabase (auth, database, realtime, RLS)
- Vercel AI SDK + AI Gateway (meeting document embeddings)
- Postmark (transactional emails for magic links and invitations)
- Google Calendar OAuth2 (meeting sync)

## Key Files

- `lib/store.tsx` — Central AppContext with all state management (clients, goals, members, auth)
- `lib/supabase-data.ts` — All Supabase queries and mutations (40+ functions)
- `lib/mock-data.ts` — TypeScript type definitions for the data model
- `lib/use-realtime-goals.ts` — Realtime subscriptions and presence tracking
- `lib/api-security.ts` — Auth helpers, rate limiting, input validation (Zod)
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server-side Supabase client
- `scripts/schema.sql` — Consolidated database schema (all tables)
- `scripts/001-022_*.sql` — Incremental migration files
- `middleware.ts` — Session refresh on protected routes

## Database Conventions

- RLS enforced via `get_user_client_ids()` helper function
- Coach identified by `clients.coach_id`; role stored in `client_members.role` ('coach' | 'member')
- Goals hierarchy: yearly_goals → quarterly_goals → quarterly_key_results → weekly_values
- Confidence levels: not_started, confident, moderately_confident, not_confident, done, discontinued
- Key result types: input, output, project

## Running Locally

```bash
npm install
npm run dev    # Starts Next.js dev server
```

Requires `.env.local` with Supabase, Postmark, Google OAuth, and AI Gateway credentials.
