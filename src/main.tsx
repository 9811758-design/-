import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { App } from "./app/App"
import { ErrorBoundary } from "./app/ErrorBoundary"
import { PwaUpdatePrompt } from "./app/PwaUpdatePrompt"
import { createAppServices } from "./app/runtime"
import "./styles.css"

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1") {
  void import("react-grab")
  void import("react-scan")
}

const rootElement = document.getElementById("root")
const services = createAppServices()

if (rootElement === null) {
  throw new Error("앱 루트 요소를 찾을 수 없습니다.")
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App services={services} />
        <PwaUpdatePrompt />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
