import { readConfig } from '@/server/config.ts'

// feat: optional side channel — post an article, or a news url to draft from
// why: the module is imported lazily so the core archive path never pays for it
export async function POST(request: Request) {
  const config = readConfig()
  if (!config.ingestEnabled) {
    return Response.json({ error: 'ingest is disabled' }, { status: 404 })
  }

  const { createIngest } = await import('@atlas/ingest')
  const ingest = createIngest({
    enabled: true,
    token: config.ingestToken,
    ...(config.modelId === undefined ? {} : { modelId: config.modelId }),
  })

  const token = request.headers.get('x-atlas-ingest-token') ?? ''
  const body: unknown = await request.json().catch(() => null)

  if (isUrlSubmission(body)) {
    const outcome = await ingest.draft({ url: body.url, token })
    return Response.json(outcome, { status: statusFor(outcome.status) })
  }

  const outcome = ingest.submit({ body, token })
  return Response.json(outcome, { status: statusFor(outcome.status) })
}

function isUrlSubmission(body: unknown): body is { url: string } {
  return (
    typeof body === 'object' && body !== null && typeof (body as { url?: unknown }).url === 'string'
  )
}

function statusFor(status: string): number {
  if (status === 'unauthorised') return 401
  if (status === 'disabled') return 404
  if (status === 'invalid' || status === 'rejected' || status === 'failed') return 422
  return 200
}
