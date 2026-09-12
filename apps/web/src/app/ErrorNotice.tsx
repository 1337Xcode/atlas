import { Component, type ErrorInfo, type ReactNode } from 'react'

// why: a failure inside a canvas leaves a black screen, which is indistinguishable from a bug in the world

export function ErrorNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="ui fixed inset-0 grid place-items-center p-8 text-center">
      <div className="flex max-w-prose flex-col gap-3">
        <p style={{ color: 'rgba(255,178,86,0.9)' }}>{title}</p>
        {detail ? <p style={{ fontSize: '0.85em', opacity: 0.75 }}>{detail}</p> : null}
        <p style={{ fontSize: '0.85em', opacity: 0.6 }}>
          Reload to try again. The console carries the full trace.
        </p>
      </div>
    </div>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { message: string | null }

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // note: the console keeps the component stack, which the notice deliberately does not show
    console.error('the newspaper failed to render', error, info.componentStack)
  }

  override render() {
    if (this.state.message === null) return this.props.children
    return <ErrorNotice title="The newspaper could not be rendered." detail={this.state.message} />
  }
}
