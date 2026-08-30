import { CloudOff, Link2, RefreshCw, Sheet } from "lucide-react"
import { type FormEvent, useCallback, useEffect, useState } from "react"
import { FormFeedback, formFeedbackIds } from "../../shared/FormFeedback"
import { errorMessage } from "../../shared/form-values"
import type { SyncSettingsService, SyncSettingsSnapshot } from "./sync-settings-service"

type SettingsPageProps = {
  readonly service?: SyncSettingsService | undefined
}

export function SettingsPage({ service }: SettingsPageProps) {
  const [snapshot, setSnapshot] = useState<SyncSettingsSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    if (service !== undefined) setSnapshot(await service.getSnapshot())
  }, [service])

  useEffect(() => {
    void reload().catch(() => setError("동기화 상태를 불러오지 못했습니다."))
  }, [reload])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
      await reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function connectExisting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (service === undefined) return
    const formData = new FormData(event.currentTarget)
    const spreadsheetId = formData.get("spreadsheetId")
    if (typeof spreadsheetId !== "string" || spreadsheetId.trim() === "") {
      setError("Spreadsheet ID를 입력해 주세요.")
      return
    }
    void run(() => service.connectExisting(spreadsheetId.trim()))
  }

  if (service === undefined || snapshot === null) {
    return (
      <main className="app-shell__body" id="main-content" tabIndex={-1}>
        <p className="empty-state" role="status">
          동기화 설정을 준비하고 있습니다.
        </p>
      </main>
    )
  }

  return (
    <main aria-busy={busy} className="app-shell__body page-stack" id="main-content" tabIndex={-1}>
      <header className="page-heading">
        <p className="eyebrow">백업과 연결</p>
        <h1>설정</h1>
        <p>기록은 항상 이 기기에 먼저 저장되고 Google Sheets에는 나중에 반영됩니다.</p>
      </header>
      <section className="surface-card backup-guide" aria-labelledby="backup-heading">
        <h2 id="backup-heading">로컬 백업과 복구</h2>
        <ul>
          <li>브라우저 데이터를 지우면 이 기기의 로컬 장부도 삭제됩니다.</li>
          <li>삭제 전 동기화 대기 0건을 확인하고 Google Sheet 사본을 보관해 주세요.</li>
          <li>현재 버전은 Google Sheets에서 앱으로 자동 복구하지 않습니다.</li>
        </ul>
      </section>
      <section className="surface-card sync-status-card" aria-labelledby="sync-heading">
        <div className="section-heading">
          <h2 id="sync-heading">Google Sheets</h2>
          <Sheet aria-hidden="true" size={22} />
        </div>
        <p>동기화 대기 {snapshot.pendingCount}건</p>
        {snapshot.spreadsheetId !== undefined && (
          <p className="sync-document">연결 문서: {snapshot.spreadsheetId}</p>
        )}
        {snapshot.status === "failed" && (
          <div className="sync-error" role="alert">
            <strong>{snapshot.lastError ?? "동기화를 완료하지 못했습니다."}</strong>
            <span>로컬 기록은 이 기기에 그대로 남아 있습니다.</span>
          </div>
        )}
        <FormFeedback
          error={error}
          id="settings-action"
          message={busy ? "Google 작업을 처리하는 중입니다…" : ""}
        />
      </section>

      {!snapshot.clientConfigured && (
        <section className="surface-card">
          <CloudOff aria-hidden="true" size={24} />
          <h2>Google 연결 설정 필요</h2>
          <p className="card-copy">
            환경변수에 OAuth 웹 클라이언트 ID를 설정해도 로컬 장부는 계속 동작합니다.
          </p>
        </section>
      )}

      {snapshot.clientConfigured && !snapshot.connected && (
        <section className="surface-card">
          <h2>Google 계정 연결</h2>
          <p className="card-copy">
            연결할 때만 Google 권한 창이 열립니다. 연결을 해제해도 로컬 기록은 유지됩니다.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => service !== undefined && void run(() => service.connectGoogle())}
            type="button"
          >
            <Link2 aria-hidden="true" size={18} /> Google 연결
          </button>
        </section>
      )}

      {snapshot.connected && snapshot.spreadsheetId === undefined && (
        <section className="surface-card sheet-choice-card">
          <h2>백업 문서 선택</h2>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void run(() => service.createTemplate())}
            type="button"
          >
            새 장부 만들기
          </button>
          <form
            aria-busy={busy}
            aria-describedby={formFeedbackIds("settings-action", error !== "")}
            aria-label="기존 장부 연결"
            className="entry-form"
            onSubmit={connectExisting}
          >
            <label>
              기존 Spreadsheet ID
              <input name="spreadsheetId" autoComplete="off" required />
            </label>
            <button className="secondary-button" disabled={busy} type="submit">
              기존 장부 연결
            </button>
          </form>
          <p className="form-help">필수 탭과 헤더가 정확히 일치하는 문서만 연결합니다.</p>
        </section>
      )}

      {snapshot.connected && snapshot.spreadsheetId !== undefined && (
        <section className="surface-card button-row sync-actions">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void run(() => service.retry())}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
            동기화 다시 시도
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void run(() => service.disconnect())}
            type="button"
          >
            Google 연결 해제
          </button>
        </section>
      )}
    </main>
  )
}
