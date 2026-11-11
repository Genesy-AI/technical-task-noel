export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

export type LeadsVerifyEmailsOutput = {
  success: boolean
  /** Emails confirmed valid. */
  verifiedCount: number
  /** Every other requested lead: invalid email, check failed, already in progress, or lead not found. */
  failedCount: number
  results: Array<{
    leadId: number
    emailVerified: boolean | null
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}


