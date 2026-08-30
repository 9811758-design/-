import { useRegisterSW } from "virtual:pwa-register/react"
import { useState } from "react"

export function PwaUpdatePrompt() {
  const [updateError, setUpdateError] = useState("")
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady && updateError === "") return null

  function close() {
    setNeedRefresh(false)
    setOfflineReady(false)
    setUpdateError("")
  }

  async function update() {
    setUpdateError("")
    try {
      await updateServiceWorker(true)
    } catch {
      setUpdateError("업데이트를 적용하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  return (
    <section className="pwa-toast" aria-labelledby="pwa-update-heading" role="status">
      <strong id="pwa-update-heading">
        {needRefresh ? "새 버전을 사용할 수 있습니다." : "오프라인 사용 준비가 끝났습니다."}
      </strong>
      <p>
        {needRefresh
          ? "저장 중인 작업이 없다면 지금 업데이트해 주세요."
          : "네트워크가 없어도 앱을 열고 로컬 장부를 기록할 수 있습니다."}
      </p>
      {updateError !== "" && (
        <p className="form-error" role="alert">
          {updateError}
        </p>
      )}
      <div className="button-row">
        {needRefresh && (
          <button className="primary-button" onClick={() => void update()} type="button">
            지금 업데이트
          </button>
        )}
        <button className="secondary-button" onClick={close} type="button">
          {needRefresh ? "나중에" : "확인"}
        </button>
      </div>
    </section>
  )
}
