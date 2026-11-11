import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowExecutionAlreadyStartedError, WorkflowFailedError } from '@temporalio/client'
import { verifyLeadEmails, VerifiableLead, VerifyLeadEmailsDeps } from './verifyLeadEmails'

const lead = (id: number, firstName: string): VerifiableLead => ({
  id,
  firstName,
  lastName: 'Test',
  email: `${firstName.toLowerCase()}@example.com`,
})
const valid = lead(1, 'Valid')
const invalid = lead(2, 'Invalid')
const slow = lead(3, 'Slow')
const busy = lead(4, 'Busy')

const workflowFailed = () => new WorkflowFailedError('Workflow execution failed', undefined, 'TIMEOUT')
const alreadyStarted = () =>
  new WorkflowExecutionAlreadyStartedError('already started', 'verify-email-4', 'verifyEmailWorkflow')

const outcomesById: Record<number, () => Promise<boolean>> = {
  [valid.id]: async () => true,
  [invalid.id]: async () => false,
  [slow.id]: async () => {
    throw workflowFailed()
  },
  [busy.id]: async () => {
    throw alreadyStarted()
  },
}

let deps: VerifyLeadEmailsDeps & { setEmailVerified: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  deps = {
    runVerification: (l) => outcomesById[l.id](),
    setEmailVerified: vi.fn().mockResolvedValue(undefined),
  }
})

describe('verifyLeadEmails', () => {
  it('should store each outcome and count only valid emails as verified', async () => {
    const leads = [valid, invalid, slow, busy]
    const outcome = await verifyLeadEmails([1, 2, 3, 4], leads, deps)

    expect(outcome.verifiedCount).toBe(1)
    expect(outcome.failedCount).toBe(3)
    expect(outcome.results).toEqual([
      { leadId: 1, emailVerified: true },
      { leadId: 2, emailVerified: false },
      { leadId: 3, emailVerified: false },
    ])
    expect(deps.setEmailVerified.mock.calls).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])
  })

  it('should mark the lead unverified and report why when the workflow fails', async () => {
    const outcome = await verifyLeadEmails([3], [slow], deps)

    expect(deps.setEmailVerified).toHaveBeenCalledWith(3, false)
    expect(outcome.errors).toEqual([{ leadId: 3, leadName: 'Slow Test', error: 'Email verification failed' }])
  })

  it('should leave the lead unchanged when verification is already in progress', async () => {
    const outcome = await verifyLeadEmails([4], [busy], deps)

    expect(deps.setEmailVerified).not.toHaveBeenCalled()
    expect(outcome.results).toEqual([])
    expect(outcome.errors).toEqual([
      { leadId: 4, leadName: 'Busy Test', error: 'Verification already in progress' },
    ])
  })

  it('should report both the verification error and the save error', async () => {
    deps.setEmailVerified.mockRejectedValue(new Error('database is locked'))
    const outcome = await verifyLeadEmails([3], [slow], deps)

    expect(outcome.results).toEqual([])
    expect(outcome.errors.map((e) => e.error)).toEqual([
      'Email verification failed',
      'Failed to save verification result: database is locked',
    ])
  })

  it('should report a save error on a successful check instead of counting it verified', async () => {
    deps.setEmailVerified.mockRejectedValue(new Error('database is locked'))
    const outcome = await verifyLeadEmails([1], [valid], deps)

    expect(outcome.verifiedCount).toBe(0)
    expect(outcome.failedCount).toBe(1)
    expect(outcome.errors.map((e) => e.error)).toEqual([
      'Failed to save verification result: database is locked',
    ])
  })

  it('should report requested IDs that match no lead, once each', async () => {
    const outcome = await verifyLeadEmails([1, 99, 99], [valid], deps)

    expect(outcome.errors).toEqual([{ leadId: 99, leadName: '', error: 'Lead not found' }])
    expect(outcome.verifiedCount).toBe(1)
    expect(outcome.failedCount).toBe(1)
  })
})
