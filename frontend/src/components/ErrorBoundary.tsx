import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  }

  public static getDerivedStateFromError() {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RepoLens frontend error', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-mist px-4">
          <div className="max-w-lg rounded-panel bg-white p-8 text-center shadow-soft">
            <h1 className="text-2xl font-semibold text-ink">Something slipped sideways.</h1>
            <p className="mt-3 text-sm text-slate-600">
              RepoLens hit an unexpected frontend error. Reloading usually clears it.
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => window.location.assign('/')}>Reload app</Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
