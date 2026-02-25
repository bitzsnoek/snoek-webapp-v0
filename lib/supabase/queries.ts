import { createClient } from '@/lib/supabase/client'

export async function getUserCompanies(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId)

  if (error) throw error
  return data
}

export async function getCompanyDetails(companyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      founders:company_founders(*),
      yearly_goals:yearly_goals(*),
      metrics:metrics(*)
    `)
    .eq('id', companyId)
    .single()

  if (error) throw error
  return data
}

export async function getQuarterlyGoals(companyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('quarterly_goals')
    .select(`
      *,
      key_results:key_results(*)
    `)
    .eq('company_id', companyId)
    .order('quarter', { ascending: false })

  if (error) throw error
  return data
}

export async function getKeyResultsWithWeekly(goalId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('key_results')
    .select(`
      *,
      weekly_values:weekly_values(*)
    `)
    .eq('goal_id', goalId)

  if (error) throw error
  return data
}

export async function updateKeyResultWeeklyValue(
  keyResultId: string,
  week: number,
  value: number
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('weekly_values')
    .upsert({
      key_result_id: keyResultId,
      week,
      value,
    })
    .eq('key_result_id', keyResultId)
    .eq('week', week)

  if (error) throw error
}

export async function updateMetricValue(
  metricId: string,
  month: number,
  value: number
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('metrics')
    .update({ [`month_${month}`]: value })
    .eq('id', metricId)

  if (error) throw error
}

export async function createYearlyGoal(
  companyId: string,
  objective: string,
  year: number
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('yearly_goals')
    .insert({
      company_id: companyId,
      objective,
      year,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createQuarterlyGoal(
  companyId: string,
  yearlyGoalId: string,
  objective: string,
  quarter: number,
  year: number
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('quarterly_goals')
    .insert({
      company_id: companyId,
      yearly_goal_id: yearlyGoalId,
      objective,
      quarter,
      year,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createKeyResult(
  goalId: string,
  title: string,
  type: 'input' | 'output' | 'project',
  target: number
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('key_results')
    .insert({
      goal_id: goalId,
      title,
      type,
      target,
      owner: null,
      confidence: 'on_track',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateKeyResultOwner(
  keyResultId: string,
  owner: string | null
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('key_results')
    .update({ owner })
    .eq('id', keyResultId)

  if (error) throw error
}

export async function deleteKeyResult(keyResultId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('key_results')
    .delete()
    .eq('id', keyResultId)

  if (error) throw error
}

export async function addFounder(
  companyId: string,
  name: string,
  role: string
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_founders')
    .insert({
      company_id: companyId,
      name,
      role,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFounder(
  founderId: string,
  name: string,
  role: string
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('company_founders')
    .update({ name, role })
    .eq('id', founderId)

  if (error) throw error
}

export async function removeFounder(founderId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('company_founders')
    .delete()
    .eq('id', founderId)

  if (error) throw error
}
