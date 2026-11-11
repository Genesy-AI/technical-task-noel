import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// Bounded so a slow verifier fails the workflow instead of retrying forever
// (Temporal's default retry policy has unlimited attempts).
// Worst case per lead: 3 attempts x 5s + 1s + 2s backoff = ~18s.
const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
