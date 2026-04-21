import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Shared helpers for attaching automation-configured items (OKR key results,
 * standard goals, journals) onto a freshly-inserted message. Used by both
 * the scheduled cron executor (`app/api/automations/execute/route.ts`) and
 * the manual "test run" endpoint (`app/api/automations/test/route.ts`) so
 * that automated messages look identical regardless of how they're fired.
 *
 * Kept in sync with the chat composer in `components/chat-section.tsx`
 * (`sendMessage`) — any new attachment type added there should also be
 * added here.
 */

/**
 * Compute the current period_key for a journal attachment.
 * Mirrors `getCurrentPeriodKey()` in `lib/mock-data.ts`, inlined here to
 * keep server routes free of client-module imports and the app-wide data
 * graph. Covers the frequencies allowed by the `journals_frequency_check`
 * constraint: `daily`, `weekly`, `biweekly`, `monthly`.
 */
export function computeCurrentPeriodKey(frequency: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  switch (frequency) {
    case "daily":
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    case "weekly": {
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
    }
    case "biweekly": {
      const d = new Date(Date.UTC(year, month, day))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      const biweekNum = Math.ceil(weekNum / 2)
      return `${d.getUTCFullYear()}-BW${String(biweekNum).padStart(2, "0")}`
    }
    case "monthly":
      return `${year}-${String(month + 1).padStart(2, "0")}`
    default:
      // Unknown frequency — fall back to a monthly key so we still produce
      // a valid attachment rather than dropping the journal entirely.
      return `${year}-${String(month + 1).padStart(2, "0")}`
  }
}

/**
 * Attach all configured goals & journals from an automation onto a message.
 *
 * Mirrors the chat composer so automated messages look identical to
 * manually-sent ones:
 *   1. OKR key results     → `message_key_results`
 *   2. Standard goals      → `message_standard_goals`
 *   3. Journal attachments → `message_journal_attachments`
 *      (`period_key` is computed at fire time from the journal's frequency
 *      so the attachment always points at the current period for that
 *      journal — matching how the chat UI resolves it at send time.)
 *
 * Must be called with a **service-role** Supabase client. Individual
 * attachment-type failures are logged but don't abort the others: a partial
 * attachment is still a better outcome than a message with none at all.
 */
export async function attachAutomationItems(
  supabase: SupabaseClient,
  automationId: string,
  messageId: string,
  logPrefix = "[Automations]"
): Promise<void> {
  // 1. OKR key results
  const { data: keyResults, error: krFetchError } = await supabase
    .from("automation_key_results")
    .select("quarterly_key_result_id")
    .eq("automation_id", automationId)

  if (krFetchError) {
    console.error(`${logPrefix} Error fetching automation_key_results:`, krFetchError)
  } else if (keyResults && keyResults.length > 0) {
    const inserts = keyResults.map((kr: { quarterly_key_result_id: string }) => ({
      message_id: messageId,
      quarterly_key_result_id: kr.quarterly_key_result_id,
    }))
    const { error } = await supabase.from("message_key_results").insert(inserts)
    if (error) console.error(`${logPrefix} Error inserting message_key_results:`, error)
  }

  // 2. Standard goals
  const { data: standardGoals, error: sgFetchError } = await supabase
    .from("automation_standard_goals")
    .select("standard_goal_id")
    .eq("automation_id", automationId)

  if (sgFetchError) {
    console.error(`${logPrefix} Error fetching automation_standard_goals:`, sgFetchError)
  } else if (standardGoals && standardGoals.length > 0) {
    const inserts = standardGoals.map((sg: { standard_goal_id: string }) => ({
      message_id: messageId,
      standard_goal_id: sg.standard_goal_id,
    }))
    const { error } = await supabase.from("message_standard_goals").insert(inserts)
    if (error) console.error(`${logPrefix} Error inserting message_standard_goals:`, error)
  }

  // 3. Journals — resolve frequency per journal, compute fire-time period_key
  type JournalLink = {
    journal_id: string
    journals: { frequency: string } | { frequency: string }[] | null
  }
  const { data: journalLinks, error: jaFetchError } = await supabase
    .from("automation_journal_attachments")
    .select("journal_id, journals!inner(frequency)")
    .eq("automation_id", automationId)

  if (jaFetchError) {
    console.error(`${logPrefix} Error fetching automation_journal_attachments:`, jaFetchError)
  } else if (journalLinks && journalLinks.length > 0) {
    const inserts = (journalLinks as unknown as JournalLink[]).map((link) => {
      const j = Array.isArray(link.journals) ? link.journals[0] : link.journals
      const frequency = j?.frequency ?? "weekly"
      return {
        message_id: messageId,
        journal_id: link.journal_id,
        period_key: computeCurrentPeriodKey(frequency),
      }
    })
    const { error } = await supabase.from("message_journal_attachments").insert(inserts)
    if (error) console.error(`${logPrefix} Error inserting message_journal_attachments:`, error)
  }
}
