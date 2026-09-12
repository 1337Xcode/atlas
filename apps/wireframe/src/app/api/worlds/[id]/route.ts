import {
  buildWorldSessionPlan,
  mintSessionToken,
  ReactorTokenError,
  SceneNotServableError,
} from '@atlas/world'
import { getArchive, getModel } from '@/server/archive.ts'
import { readConfig } from '@/server/config.ts'

// feat: mint a scoped token and hand the browser a runnable world plan
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const config = readConfig()

  if (!config.reactorApiKey) {
    return Response.json({ error: 'REACTOR_API_KEY is not configured' }, { status: 503 })
  }

  const archive = getArchive()
  const entry = await archive.find(id)
  if (!entry) return Response.json({ error: `no article "${id}"` }, { status: 404 })

  const model = getModel()

  try {
    const token = await mintSessionToken({
      apiKey: config.reactorApiKey,
      models: [model.slug],
      // note: the client closes a world after two minutes; this is the server side backstop
      // why: a few sessions per token covers a reader who resumes after an idle close
      maxSessions: 4,
      maxSessionDurationSeconds: 180,
    })

    const { plan, diagnostics } = buildWorldSessionPlan({
      article: entry.article,
      model,
      token,
      anchorImageUrl: archive.imageUrl(archive.anchorImage(entry.article)),
      soundscape: archive.soundscape(entry.article),
    })

    return Response.json(
      { plan, diagnostics },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (cause) {
    // why: the reader sees why a world refused to open, never a blank frame
    if (cause instanceof SceneNotServableError) {
      return Response.json(
        { error: cause.message, diagnostics: cause.diagnostics },
        { status: 422 },
      )
    }
    if (cause instanceof ReactorTokenError) {
      return Response.json({ error: cause.message }, { status: cause.status ?? 502 })
    }
    throw cause
  }
}
