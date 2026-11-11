import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { WorkflowFailedError } from '@temporalio/client'
import { verifyEmailWorkflow } from './workflows'
import * as activities from './activities'

const taskQueue = 'test-verify-email'
let env: TestWorkflowEnvironment

beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
})

const runWorkflow = async (activityImpl: typeof activities, email: string) => {
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: path.resolve(__dirname, './workflows.ts'),
    activities: activityImpl,
  })
  return worker.runUntil(
    env.client.workflow.execute(verifyEmailWorkflow, {
      taskQueue,
      workflowId: `test-${email}-${Math.random()}`,
      args: [email],
    })
  )
}

describe('verifyEmailWorkflow', () => {
  it('should return the verifier result', async () => {
    await expect(runWorkflow(activities, 'john.doe@example.com')).resolves.toBe(false)
    await expect(runWorkflow(activities, 'ada@example.com')).resolves.toBe(true)
  }, 60_000)

  it('should fail after 3 timed-out attempts instead of hanging', async () => {
    // Like the real jane.smith case: answers, but only after the 5s attempt timeout.
    // It must settle eventually, or worker shutdown waits for it forever.
    let attempts = 0
    const slowVerifier = {
      verifyEmail: () => {
        attempts += 1
        return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 6_000))
      },
    }

    await expect(runWorkflow(slowVerifier, 'jane.smith@example.com')).rejects.toBeInstanceOf(
      WorkflowFailedError
    )
    expect(attempts).toBe(3)
  }, 60_000)
})
