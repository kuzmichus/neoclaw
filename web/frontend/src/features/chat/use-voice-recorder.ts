import { useCallback, useEffect, useRef, useState } from "react"

export interface VoiceRecorderResult {
  type: "audio"
  url: string
  contentType: string
  filename: string
}

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp3",
  "audio/webm",
  "audio/ogg",
]

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined
  }
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }
  return undefined
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "audio/ogg":
      return "ogg"
    case "audio/mpeg":
      return "mp3"
    case "audio/wav":
    case "audio/x-wav":
      return "wav"
    case "audio/x-m4a":
    case "audio/mp4":
      return "m4a"
    case "audio/flac":
    case "audio/x-flac":
      return "flac"
    default:
      return "webm"
  }
}

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("Failed to read recorded audio"))
    }
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read recorded audio"))
    reader.readAsDataURL(blob)
  })
}

export interface UseVoiceRecorder {
  isSupported: boolean
  isRecording: boolean
  elapsedMs: number
  error: string | null
  toggle: () => void
  stop: () => void
}

export function useVoiceRecorder(
  onRecorded: (result: VoiceRecorderResult) => void,
): UseVoiceRecorder {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTsRef = useRef(0)

  const onRecordedRef = useRef(onRecorded)

  useEffect(() => {
    onRecordedRef.current = onRecorded
  }, [onRecorded])

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const finalize = useCallback(
    async (mimeType: string) => {
      const extension = extensionForMime(mimeType)
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      })
      try {
        if (blob.size === 0) {
          setError("Recording captured no audio")
          return
        }
        const url = await readBlobAsDataURL(blob)
        onRecordedRef.current({
          type: "audio",
          url,
          contentType: mimeType || "audio/webm",
          filename: `voice-message.${extension}`,
        })
      } catch {
        setError("Failed to process recorded audio")
      } finally {
        cleanup()
        setIsRecording(false)
        setElapsedMs(0)
      }
    },
    [cleanup],
  )

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state !== "inactive") {
      recorder.stop()
    }
  }, [])

  const start = useCallback(async () => {
    if (!isSupported || recorderRef.current) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickRecorderMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      chunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        void finalize(recorder.mimeType || mimeType || "audio/webm")
      }
      recorder.onerror = () => {
        setError("Recording failed")
        cleanup()
        setIsRecording(false)
      }

      recorderRef.current = recorder
      // Timeslice keeps data flowing even for short clips and avoids an
      // empty blob if the recorder stops before a single dataavailable fires.
      recorder.start(1000)
      startTsRef.current = Date.now()
      setElapsedMs(0)
      setIsRecording(true)
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTsRef.current)
      }, 200)
    } catch {
      setError("Microphone access denied")
      cleanup()
      setIsRecording(false)
    }
  }, [isSupported, finalize, cleanup])

  const toggle = useCallback(() => {
    if (isRecording) {
      stop()
    } else {
      void start()
    }
  }, [isRecording, start, stop])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    isSupported,
    isRecording,
    elapsedMs,
    error,
    toggle,
    stop,
  }
}
