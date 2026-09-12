import { IconCheck, IconCode, IconCopy, IconEye } from "@tabler/icons-react"
import mermaid from "mermaid"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

const CODE_LABEL_FONT_FAMILY =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", monospace'

let mermaidRenderSequence = 0

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  )

  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains("dark"))
    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

type MermaidViewMode = "diagram" | "code"

interface MessageMermaidProps {
  code: string
}

export function MessageMermaid({ code }: MessageMermaidProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const isDark = useIsDark()
  const [viewMode, setViewMode] = useState<MermaidViewMode>("diagram")
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const renderTimerRef = useRef<number | null>(null)

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDark ? "dark" : "default",
    })
  }, [isDark])

  useEffect(() => {
    if (renderTimerRef.current !== null) {
      window.clearTimeout(renderTimerRef.current)
    }

    renderTimerRef.current = window.setTimeout(async () => {
      const id = `mermaid-${Date.now()}-${mermaidRenderSequence++}`
      try {
        const { svg: renderedSvg } = await mermaid.render(id, code)
        setSvg(renderedSvg)
        setError(null)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : String(caughtError),
        )
      }
    }, 300)

    return () => {
      if (renderTimerRef.current !== null) {
        window.clearTimeout(renderTimerRef.current)
      }
    }
  }, [code, isDark])

  const copyLabel = isCopied ? t("chat.copiedLabel") : t("chat.copyCode")
  const toggleLabel =
    viewMode === "diagram" ? t("chat.viewCode") : t("chat.viewDiagram")

  return (
    <div
      data-picoclaw-code-block=""
      data-picoclaw-mermaid=""
      className="not-prose my-4 overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f] shadow-xs dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#c9d1d9]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#d0d7de] bg-black/[0.03] px-3 py-2 dark:border-[#30363d] dark:bg-white/[0.03]">
        <span
          className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
          style={{ fontFamily: CODE_LABEL_FONT_FAMILY }}
        >
          {t("chat.mermaidLabel")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 text-zinc-600 hover:bg-zinc-300/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => void copy(code)}
            aria-label={copyLabel}
            title={copyLabel}
          >
            {isCopied ? <IconCheck className="text-green-500" /> : <IconCopy />}
            <span className="hidden sm:inline">{copyLabel}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 px-2 text-[11px] text-zinc-600 hover:bg-zinc-300/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() =>
              setViewMode((mode) => (mode === "diagram" ? "code" : "diagram"))
            }
            aria-pressed={viewMode === "code"}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            {viewMode === "diagram" ? <IconCode /> : <IconEye />}
            <span className="hidden sm:inline">{toggleLabel}</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto bg-transparent px-4 py-3">
        {viewMode === "diagram" ? (
          error ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] text-red-600 dark:text-red-400">
                {t("chat.mermaidRenderError")}
              </p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[#d0d7de] bg-white p-3 font-mono text-[13px] leading-6 text-[#24292f] dark:border-[#30363d] dark:bg-[#010409] dark:text-[#c9d1d9]">
                <code>{code}</code>
              </pre>
            </div>
          ) : (
            <div
              className="mermaid-diagram flex justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )
        ) : (
          <pre className="m-0 overflow-x-auto font-mono text-[13px] leading-6">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
