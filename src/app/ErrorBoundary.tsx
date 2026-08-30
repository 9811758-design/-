import type { ErrorInfo, ReactNode } from "react"
import { Component } from "react"

type ErrorBoundaryProps = {
  readonly children: ReactNode
}

type ErrorBoundaryState = {
  readonly hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("카페 장부 렌더링 오류", { error, errorInfo })
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="error-page" id="main-content">
          <h1>화면을 불러오지 못했습니다.</h1>
          <p>이미 저장한 로컬 기록은 이 기기에 남아 있습니다. 화면을 다시 불러와 주세요.</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            화면 다시 불러오기
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
