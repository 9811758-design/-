import {
  BarChart3,
  BookOpenCheck,
  ClipboardPlus,
  LayoutDashboard,
  ListChecks,
  Settings,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { NavLink, Route, Routes, useLocation } from "react-router"
import { AnalyticsPage } from "../features/analytics/AnalyticsPage"
import { DashboardPage } from "../features/dashboard/DashboardPage"
import { HistoryPage } from "../features/history/HistoryPage"
import { RecordPage } from "../features/record/RecordPage"
import { SettingsPage } from "../features/settings/SettingsPage"
import type { AppServices } from "./app-services"

type AppProps = {
  readonly services?: AppServices
}

const navigationItems = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/record", label: "기록", icon: ClipboardPlus, end: false },
  { to: "/history", label: "내역", icon: ListChecks, end: false },
  { to: "/analytics", label: "통계", icon: BarChart3, end: false },
  { to: "/settings", label: "설정", icon: Settings, end: false },
] as const

function PendingPage({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <main className="app-shell__body" id="main-content" tabIndex={-1}>
      <section className="status-panel" aria-labelledby="pending-heading">
        <BookOpenCheck aria-hidden="true" size={28} />
        <h1 id="pending-heading">{title}</h1>
        <p>{detail}</p>
      </section>
    </main>
  )
}

function useOnlineState(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)
    window.addEventListener("online", markOnline)
    window.addEventListener("offline", markOffline)
    return () => {
      window.removeEventListener("online", markOnline)
      window.removeEventListener("offline", markOffline)
    }
  }, [])

  return online
}

function RouteFocus() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)

  useEffect(() => {
    if (previousPath.current !== pathname) {
      document.querySelector<HTMLElement>("#main-content")?.focus()
      previousPath.current = pathname
    }
  }, [pathname])

  return null
}

function PrimaryNavigation() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {navigationItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          className={({ isActive }) => `bottom-nav__item${isActive ? " is-active" : ""}`}
          end={end}
          key={to}
          to={to}
        >
          <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function App({ services }: AppProps) {
  const online = useOnlineState()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="app-shell__header">
        <span className="app-shell__brand">
          <span aria-hidden="true" className="brand-logo brand-logo--header" />
          <span>쿠크봉 지출 장부</span>
        </span>
        <span className="app-shell__header-status" aria-live="polite">
          {online ? "기기에 안전하게 저장" : "오프라인 · 기기에 저장"}
        </span>
      </header>
      <RouteFocus />
      <Routes>
        <Route path="/" element={<DashboardPage service={services?.ledgerViewService} />} />
        <Route path="/record" element={<RecordPage services={services} />} />
        <Route path="/history" element={<HistoryPage service={services?.ledgerViewService} />} />
        <Route
          path="/analytics"
          element={<AnalyticsPage service={services?.ledgerViewService} />}
        />
        <Route
          path="/settings"
          element={<SettingsPage service={services?.syncSettingsService} />}
        />
        <Route
          path="*"
          element={
            <PendingPage title="페이지를 찾을 수 없습니다" detail="하단 메뉴에서 이동해 주세요." />
          }
        />
      </Routes>
      <PrimaryNavigation />
    </div>
  )
}
