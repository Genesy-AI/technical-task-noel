import { WorkflowExecutionAlreadyStartedError, WorkflowFailedError } from '@temporalio/client'

export type VerifiableLead = { id: number; firstName: string; lastName: string; email: string }
type VerifyError = { leadId: number; leadName: string; error: string }

export type VerifyLeadEmailsDeps = {
  runVerification: (lead: VerifiableLead) => Promise<boolean>
  setEmailVerified: (leadId: number, emailVerified: boolean) => Promise<unknown>
}

const errorMessage = (error: unknown): string => {
  if (error instanceof WorkflowExecutionAlreadyStartedError) return 'Verification already in progress'
  // Covers activity failures after retries, workflow timeouts, cancellation and termination.
  if (error instanceof WorkflowFailedError) return 'Email verification failed'
  return error instanceof Error ? error.message : 'Unknown error'
}

const saveErrorMessage = (error: unknown) => `Failed to save verification result: ${errorMessage(error)}`

// Returns the stored outcome (null if nothing was stored) and every error that occurred along the way.
const verifyLead = async (
  lead: VerifiableLead,
  deps: VerifyLeadEmailsDeps
): Promise<{ emailVerified: boolean | null; errors: string[] }> => {
  let isVerified: boolean
  try {
    isVerified = await deps.runVerification(lead)
  } catch (error) {
    console.error(`Email verification failed for lead ${lead.id}:`, error)
    const errors = [errorMessage(error)]
    // "Already in progress" (or any error before a run) checked nothing, so the lead is left as it is.
    if (!(error instanceof WorkflowFailedError)) return { emailVerified: null, errors }
    // emailVerified is the latest outcome, so a failed check marks the lead unverified.
    try {
      await deps.setEmailVerified(lead.id, false)
      return { emailVerified: false, errors }
    } catch (saveError) {
      console.error(`Failed to save verification result for lead ${lead.id}:`, saveError)
      return { emailVerified: null, errors: [...errors, saveErrorMessage(saveError)] }
    }
  }

  try {
    await deps.setEmailVerified(lead.id, isVerified)
    return { emailVerified: isVerified, errors: [] }
  } catch (saveError) {
    console.error(`Failed to save verification result for lead ${lead.id}:`, saveError)
    return { emailVerified: null, errors: [saveErrorMessage(saveError)] }
  }
}

/**
 * Verifies leads in parallel. `verifiedCount` is the number of emails confirmed valid; `failedCount` is
 * every other requested lead (invalid, check failed, already in progress, or not found).
 */
export const verifyLeadEmails = async (
  leadIds: number[],
  leads: VerifiableLead[],
  deps: VerifyLeadEmailsDeps
) => {
  const requestedIds = [...new Set(leadIds)]
  const foundIds = new Set(leads.map((lead) => lead.id))
  const results: Array<{ leadId: number; emailVerified: boolean }> = []
  const errors: VerifyError[] = requestedIds
    .filter((id) => !foundIds.has(id))
    .map((leadId) => ({ leadId, leadName: '', error: 'Lead not found' }))

  const outcomes = await Promise.all(leads.map((lead) => verifyLead(lead, deps)))
  outcomes.forEach((outcome, i) => {
    const lead = leads[i]
    if (outcome.emailVerified !== null)
      results.push({ leadId: lead.id, emailVerified: outcome.emailVerified })
    const leadName = `${lead.firstName} ${lead.lastName}`.trim()
    outcome.errors.forEach((error) => errors.push({ leadId: lead.id, leadName, error }))
  })

  const verifiedCount = results.filter((result) => result.emailVerified).length
  return { verifiedCount, failedCount: requestedIds.length - verifiedCount, results, errors }
}
