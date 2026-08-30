import { useEffect, useRef } from "react"

type FormFeedbackProps = {
  readonly error: string
  readonly id: string
  readonly message?: string
}

export function formFeedbackIds(id: string, hasError: boolean): string {
  return hasError ? `${id}-status ${id}-error` : `${id}-status`
}

export function FormFeedback({ error, id, message = "" }: FormFeedbackProps) {
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (error !== "") errorRef.current?.focus()
  }, [error])

  return (
    <>
      <p className="form-message" id={`${id}-status`} aria-live="polite">
        {message}
      </p>
      {error !== "" && (
        <p className="form-error" id={`${id}-error`} ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
    </>
  )
}
