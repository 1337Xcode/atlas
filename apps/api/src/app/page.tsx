import { getArchive } from '@/server/archive.ts'

// why: hitting the service root should say what it is, not return a framework default
export default async function ServiceRoot() {
  const archive = getArchive()
  const servable = await archive.servable()
  const problems = await archive.problems()

  return (
    <main
      style={{
        margin: '0 auto',
        padding: '3rem 1.5rem',
        maxWidth: '42rem',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 500 }}>Atlas API</h1>
      <p>
        The archive and world-session service. The reader runs separately, on port 5173 in
        development.
      </p>
      <p>
        Serving {servable.length} {servable.length === 1 ? 'article' : 'articles'}
        {problems.length > 0 ? `, withholding ${problems.length}` : ''}.
      </p>
      <ul>
        <li>
          <code>GET /api/articles</code>
        </li>
        <li>
          <code>POST /api/worlds/[id]</code>
        </li>
        <li>
          <code>GET /api/images/[...path]</code>
        </li>
      </ul>
    </main>
  )
}
