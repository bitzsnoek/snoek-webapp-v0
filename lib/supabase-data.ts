import { createClient } from "@/lib/supabase/client"
import type { Company, CompanyMember, Year, YearlyGoal, YearlyKeyResult, Quarter, QuarterlyGoal, KeyResult, KeyResultType, Metric, Founder, Confidence } from "./mock-data"

// ============================================================
// Map DB confidence values to frontend Confidence type
// ============================================================
function mapConfidence(val: string | null): Confidence {
  const map: Record<string, Confidence> = {
    high: "confident",
    medium: "moderately_confident",
    low: "not_confident",
    done: "done",
    discontinued: "discontinued",
  }
  return map[val ?? ""] ?? "not_started"
}

function mapConfidenceToDb(val: Confidence): string {
  const map: Record<Confidence, string> = {
    confident: "high",
    moderately_confident: "medium",
    not_confident: "low",
    not_started: "not_started",
    done: "done",
    discontinued: "discontinued",
  }
  return map[val]
}

// ============================================================
// Map DB KR type to frontend KeyResultType
// ============================================================
function mapKRType(dbType: string): KeyResultType {
  if (dbType === "input") return "input"
  if (dbType === "project") return "project"
  return "output" // cumulative -> output
}

function mapKRTypeToDb(feType: KeyResultType): string {
  if (feType === "input") return "input"
  if (feType === "project") return "project"
  return "cumulative"
}

// ============================================================
// Fetch a single company with all nested data
// ============================================================
export async function fetchCompanyData(companyId: string): Promise<Company | null> {
  const supabase = createClient()

  // Phase 1: Fetch core data in parallel
  // Note: get_company_members_with_email is a secure function that replaces the insecure view
  const [companyRes, membersRes, yearlyGoalsRes, quarterlyGoalsRes, metricsRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.rpc("get_company_members_with_email", { p_company_id: companyId }),
    supabase.from("yearly_goals").select("*").eq("company_id", companyId).order("year", { ascending: false }).order("position", { ascending: true }),
    supabase.from("quarterly_goals").select("*").eq("company_id", companyId).order("year", { ascending: false }).order("position", { ascending: true }),
    supabase.from("metrics").select("*").eq("company_id", companyId),
  ])

  const company = companyRes.data
  const members = membersRes.data
  const yearlyGoals = yearlyGoalsRes.data
  const quarterlyGoals = quarterlyGoalsRes.data
  const metrics = metricsRes.data

  if (!company) return null

  // Phase 2: Fetch related data using IDs from phase 1
  const yearlyGoalIds = (yearlyGoals ?? []).map((g: any) => g.id)
  const quarterlyGoalIds = (quarterlyGoals ?? []).map((g: any) => g.id)
  const metricIds = (metrics ?? []).map((m: any) => m.id)

  const [
    { data: yearlyKRs },
    { data: quarterlyKRs },
    { data: metricVals },
  ] = await Promise.all([
    yearlyGoalIds.length > 0
      ? supabase.from("yearly_key_results").select("*").in("yearly_goal_id", yearlyGoalIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    quarterlyGoalIds.length > 0
      ? supabase.from("quarterly_key_results").select("*").in("quarterly_goal_id", quarterlyGoalIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    metricIds.length > 0
      ? supabase.from("metric_values").select("*").in("metric_id", metricIds)
      : Promise.resolve({ data: [] }),
  ])

  // Phase 3: Fetch weekly values for all quarterly KRs
  const qkrIds = (quarterlyKRs ?? []).map((kr: any) => kr.id)
  const { data: weeklyVals } = qkrIds.length > 0
    ? await supabase.from("weekly_values").select("*").in("quarterly_key_result_id", qkrIds)
    : { data: [] }

  // Build founder lookup by member id
  const memberMap = new Map((members ?? []).map((m: any) => [m.id, m]))

  // Build founders (backwards compat)
  const founders: Founder[] = (members ?? [])
    .filter((m: any) => m.role === "founder")
    .map((m: any) => ({
      id: m.id,
      name: m.name ?? "",
      role: m.role_title ?? "",
      avatar: "",
      emails: m.emails ?? [],
      userEmail: m.user_email ?? undefined,
    }))

  // Build all members (coaches + founders) for owner assignment
  const allMembers: CompanyMember[] = (members ?? []).map((m: any) => ({
    id: m.id,
    name: m.name ?? "",
    role: m.role ?? "founder",
    roleTitle: m.role_title ?? m.role ?? "",
    avatar: m.avatar_url ?? "",
    email: m.user_email ?? "",
  }))

  // Build weekly values lookup: kr_id -> { W1: val, W2: val, ... }
  const weeklyMap = new Map<string, Record<string, number>>()
  for (const wv of weeklyVals ?? []) {
    const krId = wv.quarterly_key_result_id
    if (!weeklyMap.has(krId)) weeklyMap.set(krId, {})
    weeklyMap.get(krId)![`W${wv.week}`] = wv.value
  }

  // Build quarterly KR lookup: qg_id -> KeyResult[]
  const qkrByGoal = new Map<string, KeyResult[]>()
  for (const kr of quarterlyKRs ?? []) {
    const goalId = kr.quarterly_goal_id
    if (!qkrByGoal.has(goalId)) qkrByGoal.set(goalId, [])
    const owner = kr.owner_id ? memberMap.get(kr.owner_id)?.name ?? null : null
    qkrByGoal.get(goalId)!.push({
      id: kr.id,
      title: kr.title,
      type: mapKRType(kr.type),
      owner,
      isMonthlyPriority: kr.is_priority ?? false,
      target: kr.target ?? 0,
      weeklyValues: weeklyMap.get(kr.id) ?? {},
    })
  }

  // Build quarterly goals by quarter key (year-quarter)
  const quarterMap = new Map<string, Quarter>()
  for (const qg of quarterlyGoals ?? []) {
    const key = `${qg.year}-${qg.quarter}`
    if (!quarterMap.has(key)) {
      quarterMap.set(key, {
        id: key,
        label: `Q${qg.quarter} ${qg.year}`,
        year: qg.year,
        isActive: !(qg.archived ?? false),
        goals: [],
      })
    }
    const quarter = quarterMap.get(key)!
    // If any goal in this quarter is not archived, the quarter is active
    if (!(qg.archived ?? false)) quarter.isActive = true

    quarter.goals.push({
      id: qg.id,
      objective: qg.objective,
      yearlyGoalId: qg.yearly_goal_id ?? "",
      keyResults: qkrByGoal.get(qg.id) ?? [],
    })
  }

  // Build yearly KR lookup: yg_id -> YearlyKeyResult[]
  const ykrByGoal = new Map<string, YearlyKeyResult[]>()
  for (const kr of yearlyKRs ?? []) {
    const goalId = kr.yearly_goal_id
    if (!ykrByGoal.has(goalId)) ykrByGoal.set(goalId, [])
    ykrByGoal.get(goalId)!.push({
      id: kr.id,
      title: kr.title,
      confidence: mapConfidence(kr.confidence),
    })
  }

  // Build yearly goals by year
  const yearMap = new Map<number, Year>()
  for (const yg of yearlyGoals ?? []) {
    if (!yearMap.has(yg.year)) {
      yearMap.set(yg.year, {
        id: `y-${yg.year}`,
        year: yg.year,
        isActive: !(yg.archived ?? false),
        goals: [],
      })
    }
    const year = yearMap.get(yg.year)!
    if (!(yg.archived ?? false)) year.isActive = true

    year.goals.push({
      id: yg.id,
      objective: yg.objective,
      keyResults: ykrByGoal.get(yg.id) ?? [],
    })
  }

  // Build metric values lookup: metric_id -> { month: value }
  const metricValMap = new Map<string, Record<number, number>>()
  for (const mv of metricVals ?? []) {
    const mId = mv.metric_id
    if (!metricValMap.has(mId)) metricValMap.set(mId, {})
    metricValMap.get(mId)![mv.month] = mv.value
  }

  // Build metrics
  const metricList: Metric[] = (metrics ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    description: m.description ?? "",
    category: m.category ?? "",
    values: metricValMap.get(m.id) ?? {},
  }))

  return {
    id: company.id,
    name: company.name,
    timezone: company.timezone || "UTC",
    founders,
    members: allMembers,
    years: Array.from(yearMap.values()),
    quarters: Array.from(quarterMap.values()),
    metrics: metricList,
  }
}

// ============================================================
// Fetch all companies for a user (via company_members)
// ============================================================
export async function fetchUserCompanies(userId: string): Promise<Company[]> {
  const supabase = createClient()

  // Get companies where user is a member
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)

  // Also get companies where user is the coach (owner)
  const { data: coached } = await supabase
    .from("companies")
    .select("id")
    .eq("coach_id", userId)

  // Deduplicate company IDs
  const companyIds = new Set<string>()
  for (const m of memberships ?? []) companyIds.add(m.company_id)
  for (const c of coached ?? []) companyIds.add(c.id)

  if (companyIds.size === 0) return []

  const companies: Company[] = []
  for (const id of companyIds) {
    const company = await fetchCompanyData(id)
    if (company) companies.push(company)
  }
  return companies
}

// ============================================================
// Mutation helpers
// ============================================================

export async function dbUpdateWeeklyValue(krId: string, week: number, value: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from("weekly_values")
    .upsert({ quarterly_key_result_id: krId, week, value }, { onConflict: "quarterly_key_result_id,week" })
  if (error) console.error("[v0] dbUpdateWeeklyValue error:", error)
}

export async function dbAddYearlyGoal(companyId: string, year: number, objective: string, keyResults: string[]) {
  const supabase = createClient()
  const { data: goal, error } = await supabase
    .from("yearly_goals")
    .insert({ company_id: companyId, year, objective, archived: false })
    .select()
    .single()
  if (error || !goal) { console.error("[v0] dbAddYearlyGoal error:", error); return null }

  for (const title of keyResults.filter(t => t.trim())) {
    await supabase.from("yearly_key_results").insert({
      yearly_goal_id: goal.id,
      title,
      confidence: "not_started",
    })
  }
  return goal.id as string
}

export async function dbUpdateYearlyGoal(goalId: string, objective: string, keyResults: { id?: string; title: string; confidence: Confidence }[]) {
  const supabase = createClient()
  await supabase.from("yearly_goals").update({ objective }).eq("id", goalId)

  // Delete existing KRs and re-insert
  await supabase.from("yearly_key_results").delete().eq("yearly_goal_id", goalId)
  for (const kr of keyResults) {
    await supabase.from("yearly_key_results").insert({
      yearly_goal_id: goalId,
      title: kr.title,
      confidence: mapConfidenceToDb(kr.confidence),
    })
  }
}

export async function dbDeleteYearlyGoal(goalId: string) {
  const supabase = createClient()
  await supabase.from("yearly_key_results").delete().eq("yearly_goal_id", goalId)
  await supabase.from("yearly_goals").delete().eq("id", goalId)
}

export async function dbUpdateYearlyKRConfidence(krId: string, confidence: Confidence) {
  const supabase = createClient()
  await supabase.from("yearly_key_results").update({ confidence: mapConfidenceToDb(confidence) }).eq("id", krId)
}

export async function dbAddQuarterlyGoal(companyId: string, year: number, quarter: number, yearlyGoalId: string, objective: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quarterly_goals")
    .insert({
      company_id: companyId,
      year,
      quarter,
      yearly_goal_id: yearlyGoalId || null,
      objective,
      archived: false,
    })
    .select()
    .single()
  if (error) { console.error("[v0] dbAddQuarterlyGoal error:", error); return null }
  return data.id as string
}

export async function dbUpdateQuarterlyGoal(goalId: string, objective: string, yearlyGoalId: string) {
  const supabase = createClient()
  await supabase.from("quarterly_goals").update({
    objective,
    yearly_goal_id: yearlyGoalId || null,
  }).eq("id", goalId)
}

export async function dbDeleteQuarterlyGoal(goalId: string) {
  const supabase = createClient()
  // Delete weekly values for all KRs under this goal
  const { data: krs } = await supabase.from("quarterly_key_results").select("id").eq("quarterly_goal_id", goalId)
  for (const kr of krs ?? []) {
    await supabase.from("weekly_values").delete().eq("quarterly_key_result_id", kr.id)
  }
  await supabase.from("quarterly_key_results").delete().eq("quarterly_goal_id", goalId)
  await supabase.from("quarterly_goals").delete().eq("id", goalId)
}

export async function dbAddKeyResult(goalId: string, kr: Omit<KeyResult, "id">, ownerMemberId: string | null) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quarterly_key_results")
    .insert({
      quarterly_goal_id: goalId,
      title: kr.title,
      type: mapKRTypeToDb(kr.type),
      target: kr.target,
      owner_id: ownerMemberId,
      is_priority: kr.isMonthlyPriority,
    })
    .select()
    .single()
  if (error) { console.error("[v0] dbAddKeyResult error:", error); return null }
  return data.id as string
}

export async function dbUpdateKeyResult(krId: string, updates: Partial<KeyResult>, ownerMemberId?: string | null) {
  const supabase = createClient()
  const dbUpdates: any = {}
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.type !== undefined) dbUpdates.type = mapKRTypeToDb(updates.type)
  if (updates.target !== undefined) dbUpdates.target = updates.target
  if (updates.isMonthlyPriority !== undefined) dbUpdates.is_priority = updates.isMonthlyPriority
  if (ownerMemberId !== undefined) dbUpdates.owner_id = ownerMemberId

  if (Object.keys(dbUpdates).length > 0) {
    await supabase.from("quarterly_key_results").update(dbUpdates).eq("id", krId)
  }
}

export async function dbDeleteKeyResult(krId: string) {
  const supabase = createClient()
  await supabase.from("weekly_values").delete().eq("quarterly_key_result_id", krId)
  await supabase.from("quarterly_key_results").delete().eq("id", krId)
}

export async function dbAssignKROwner(krId: string, ownerMemberId: string | null) {
  const supabase = createClient()
  await supabase.from("quarterly_key_results").update({ owner_id: ownerMemberId }).eq("id", krId)
}

export async function dbAddCompany(name: string, userId: string): Promise<string | null> {
  const supabase = createClient()
  // Generate ID client-side to avoid the SELECT RLS chicken-and-egg issue:
  // The INSERT succeeds but .select() is blocked because the user isn't a member yet.
  const companyId = crypto.randomUUID()

  // Fetch the coach's actual name from their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single()
  const coachName = profile?.full_name || "Coach"

  const { error } = await supabase
    .from("companies")
    .insert({ id: companyId, name, coach_id: userId })
  if (error) { console.error("dbAddCompany company error:", error); return null }

  // Now add the user as a member so RLS grants full access
  const { error: memberError } = await supabase
    .from("company_members")
    .insert({ company_id: companyId, user_id: userId, role: "coach", name: coachName })
  if (memberError) { console.error("dbAddCompany member error:", memberError); return null }

  return companyId
}

export async function dbDeleteCompany(companyId: string) {
  const supabase = createClient()

  // Cascade delete all related data (child-first)
  // 1. weekly_values via quarterly_key_results via quarterly_goals
  const { data: qGoals } = await supabase.from("quarterly_goals").select("id").eq("company_id", companyId)
  const qGoalIds = (qGoals ?? []).map((g: any) => g.id)
  if (qGoalIds.length > 0) {
    const { data: qKrs } = await supabase.from("quarterly_key_results").select("id").in("quarterly_goal_id", qGoalIds)
    const qKrIds = (qKrs ?? []).map((kr: any) => kr.id)
    if (qKrIds.length > 0) {
      await supabase.from("weekly_values").delete().in("quarterly_key_result_id", qKrIds)
    }
    await supabase.from("quarterly_key_results").delete().in("quarterly_goal_id", qGoalIds)
  }
  await supabase.from("quarterly_goals").delete().eq("company_id", companyId)

  // 2. yearly_key_results via yearly_goals
  const { data: yGoals } = await supabase.from("yearly_goals").select("id").eq("company_id", companyId)
  const yGoalIds = (yGoals ?? []).map((g: any) => g.id)
  if (yGoalIds.length > 0) {
    await supabase.from("yearly_key_results").delete().in("yearly_goal_id", yGoalIds)
  }
  await supabase.from("yearly_goals").delete().eq("company_id", companyId)

  // 3. metric_values via metrics
  const { data: mets } = await supabase.from("metrics").select("id").eq("company_id", companyId)
  const metIds = (mets ?? []).map((m: any) => m.id)
  if (metIds.length > 0) {
    await supabase.from("metric_values").delete().in("metric_id", metIds)
  }
  await supabase.from("metrics").delete().eq("company_id", companyId)

  // 4. company_members
  await supabase.from("company_members").delete().eq("company_id", companyId)

  // 5. company itself
  await supabase.from("companies").delete().eq("id", companyId)
}

export async function dbUpdateCompanyName(companyId: string, name: string) {
  const supabase = createClient()
  await supabase.from("companies").update({ name }).eq("id", companyId)
}

// ============================================================
// Invitations
// ============================================================

export interface Invitation {
  id: string
  company_id: string
  email: string
  role: "founder" | "coach"
  token: string
  invited_by: string
  status: "pending" | "accepted"
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export async function dbInviteUser(
  companyId: string,
  email: string,
  role: "founder" | "coach",
  invitedBy: string,
  founderName?: string,
  memberId?: string
): Promise<Invitation | null> {
  const supabase = createClient()
  // Generate IDs client-side to avoid .select() RLS issues
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const createdAt = new Date().toISOString()

  const insertData: Record<string, unknown> = {
    id,
    company_id: companyId,
    email,
    role,
    token,
    invited_by: invitedBy,
    expires_at: expiresAt,
  }
  if (memberId) {
    insertData.member_id = memberId
  }

  const { error } = await supabase
    .from("invitations")
    .insert(insertData)

  if (error) {
    console.error("dbInviteUser error:", error)
    return null
  }

  // Build the invitation object locally since we can't read it back via RLS
  const invitation: Invitation = {
    id,
    company_id: companyId,
    email,
    role,
    token,
    invited_by: invitedBy,
    status: "pending",
    accepted_at: null,
    expires_at: expiresAt,
    created_at: createdAt,
  }

  // Send invitation email
  try {
    const senderProfile = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", invitedBy)
      .single()

    const senderName = senderProfile.data?.full_name || "Your coach"

    const emailResponse = await fetch("/api/send-invitation-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        founderName: founderName || email.split("@")[0],
        invitationToken: token,
        senderName,
        companyId, // Required for authorization check
      }),
    })
    
    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}))
      console.error("Failed to send invitation email:", emailResponse.status, errorData)
    }
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError)
    // Don't fail the invitation creation if email fails
  }

  return invitation
}

export async function dbGetInvitations(companyId: string): Promise<Invitation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("dbGetInvitations error:", error)
    return []
  }
  return (data ?? []) as Invitation[]
}

export async function dbCancelInvitation(invitationId: string) {
  const supabase = createClient()
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId)
  if (error) console.error("dbCancelInvitation error:", error)
}

export async function dbAcceptInvitation(
  token: string,
  userId: string
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  const supabase = createClient()

  // Get the invitation
  const { data: invitation, error: getError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (getError || !invitation) {
    return { success: false, error: "Invitation not found or already used" }
  }

  const inv = invitation as Invitation

  // Check expiry
  if (new Date(inv.expires_at) < new Date()) {
    return { success: false, error: "Invitation has expired" }
  }

  // Check if user is already a member of this company
  const { data: alreadyMember } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", inv.company_id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (!alreadyMember) {
    // Check if an unconnected founder with matching name exists in this company
    const nameFromEmail = inv.email.split("@")[0]
    const { data: existingMember } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", inv.company_id)
      .is("user_id", null)
      .ilike("name", nameFromEmail)
      .single()

    if (existingMember) {
      // Link the auth user to the existing unconnected founder
      const { error: linkError } = await supabase
        .from("company_members")
        .update({ user_id: userId })
        .eq("id", existingMember.id)

      if (linkError) {
        console.error("dbAcceptInvitation link error:", linkError)
        return { success: false, error: "Failed to link user to founder" }
      }
    } else {
      // Create a new company member for this user
      const { error: memberError } = await supabase.from("company_members").insert({
        company_id: inv.company_id,
        user_id: userId,
        role: inv.role,
        name: nameFromEmail,
      })

      if (memberError) {
        console.error("dbAcceptInvitation member error:", memberError)
        return { success: false, error: "Failed to add user to company" }
      }
    }
  }

  // Mark invitation as accepted
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", inv.id)

  if (updateError) {
    console.error("dbAcceptInvitation update error:", updateError)
    return { success: false, error: "Failed to accept invitation" }
  }

  return { success: true, companyId: inv.company_id }
}

export interface UnconnectedFounder {
  id: string
  company_id: string
  name: string
  role_title: string
  role: string
}

export async function dbGetUnconnectedFounders(companyId: string): Promise<UnconnectedFounder[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("company_members")
    .select("id, company_id, name, role_title, role")
    .eq("company_id", companyId)
    .is("user_id", null)
    .order("name", { ascending: true })

  if (error) {
    console.error("dbGetUnconnectedFounders error:", error)
    return []
  }
  return (data ?? []) as UnconnectedFounder[]
}

export async function dbAddFounder(companyId: string, name: string, roleTitle: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("company_members")
    .insert({ company_id: companyId, role: "founder", name, role_title: roleTitle })
    .select()
    .single()
  if (error) { console.error("[v0] dbAddFounder error:", error); return null }
  return data.id as string
}

export async function dbUpdateFounder(memberId: string, name: string, roleTitle: string, emails?: string[]) {
  console.log("[v0] dbUpdateFounder called:", { memberId, name, roleTitle, emails })
  const supabase = createClient()
  const updates: Record<string, any> = { name, role_title: roleTitle }
  if (emails !== undefined) updates.emails = emails
  console.log("[v0] Updating company_members with:", updates)
  const { error } = await supabase.from("company_members").update(updates).eq("id", memberId)
  if (error) {
    console.error("[v0] dbUpdateFounder error:", error)
  } else {
    console.log("[v0] dbUpdateFounder success")
  }
}

export async function dbRemoveFounder(memberId: string) {
  const supabase = createClient()
  await supabase.from("company_members").delete().eq("id", memberId)
}

export async function dbUpdateMetricValue(metricId: string, month: number, value: number) {
  const supabase = createClient()
  await supabase
    .from("metric_values")
    .upsert({ metric_id: metricId, month, value }, { onConflict: "metric_id,month" })
}

export async function dbAddMetric(companyId: string, metric: Omit<Metric, "id">) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("metrics")
    .insert({ company_id: companyId, name: metric.name, description: metric.description, category: metric.category })
    .select()
    .single()
  if (error) { console.error("[v0] dbAddMetric error:", error); return null }
  return data.id as string
}

export async function dbDeleteMetric(metricId: string) {
  const supabase = createClient()
  await supabase.from("metric_values").delete().eq("metric_id", metricId)
  await supabase.from("metrics").delete().eq("id", metricId)
}

export async function dbArchiveQuarter(companyId: string, quarterKey: string, archived: boolean) {
  const supabase = createClient()
  // quarterKey = "2025-1" -> year=2025, quarter=1
  const [yearStr, qStr] = quarterKey.split("-")
  await supabase.from("quarterly_goals").update({ archived }).eq("company_id", companyId).eq("year", parseInt(yearStr)).eq("quarter", parseInt(qStr))
}

export async function dbArchiveYear(companyId: string, year: number, archived: boolean) {
  const supabase = createClient()
  await supabase.from("yearly_goals").update({ archived }).eq("company_id", companyId).eq("year", year)
}

export async function dbAddYear(companyId: string, year: number) {
  // No-op for DB - yearly_goals handles this. The "year" is just a grouping.
  return `y-${year}`
}

export async function dbAddQuarter(companyId: string, label: string, year: number) {
  // No-op for DB - quarterly_goals handles this. The "quarter" is just a grouping.
  const match = label.match(/Q(\d)/)
  const q = match ? parseInt(match[1]) : 1
  return `${year}-${q}`
}

// ============================================================
// Reordering functions
// ============================================================

export async function dbReorderYearlyGoals(goalIds: string[]) {
  const supabase = createClient()
  // Update position for each goal based on array order
  for (let i = 0; i < goalIds.length; i++) {
    await supabase.from("yearly_goals").update({ position: i }).eq("id", goalIds[i])
  }
}

export async function dbReorderYearlyKeyResults(krIds: string[]) {
  const supabase = createClient()
  for (let i = 0; i < krIds.length; i++) {
    await supabase.from("yearly_key_results").update({ position: i }).eq("id", krIds[i])
  }
}

export async function dbReorderQuarterlyGoals(goalIds: string[]) {
  const supabase = createClient()
  for (let i = 0; i < goalIds.length; i++) {
    await supabase.from("quarterly_goals").update({ position: i }).eq("id", goalIds[i])
  }
}

export async function dbReorderQuarterlyKeyResults(krIds: string[]) {
  const supabase = createClient()
  for (let i = 0; i < krIds.length; i++) {
    await supabase.from("quarterly_key_results").update({ position: i }).eq("id", krIds[i])
  }
}


