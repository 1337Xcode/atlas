import { Component, type ErrorInfo, type ReactNode } from 'react'

// why: a failure that leaves a black screen is indistinguishable from a bug in the world itself

export function ErrorNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="reader-failure" role="alert">
      <div>
        <strong>{title}</strong>
        {detail ? <p>{detail}</p> : null}
        <p>Reload to try again. The console carries the full trace.</p>
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
