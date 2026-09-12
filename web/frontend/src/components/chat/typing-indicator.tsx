import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { AgentStatus } from "@/store/chat"

const ACTIVE_PHASES: AgentStatus["phase"][] = ["tool", "skill", "mcp", "web"]

function resolveStatusLabel(
  status: AgentStatus | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
): string | null {
  if (!status || !ACTIVE_PHASES.includes(status.phase)) {
    return null
  }
  switch (status.phase) {
    case "skill":
      return t("chat.status.skill", { name: status.label })
    case "mcp":
      return t("chat.status.mcp", { name: status.label })
    case "web":
      return t("chat.status.web")
    case "tool":
    default:
      return t("chat.status.tool", { name: status.label })
  }
}

export function TypingIndicator({ status }: { status?: AgentStatus | null }) {
  const { t } = useTranslation()
  const activeLabel = resolveStatusLabel(status, t)

  const thinkingSteps = [
    t("chat.thinking.step1"),
    t("chat.thinking.step2"),
    t("chat.thinking.step3"),
    t("chat.thinking.step4"),
    t("chat.thinking.step5"),
    t("chat.thinking.step6"),
    t("chat.thinking.step7"),
    t("chat.thinking.step8"),
    t("chat.thinking.step9"),
  ]
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const stepsCount = thinkingSteps.length
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % stepsCount)
    }, 3000)
    return () => clearInterval(interval)
  }, [thinkingSteps.length])

  const label = activeLabel ?? thinkingSteps[stepIndex]

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="bg-card border-border/50 inline-flex w-fit max-w-xs flex-col gap-3 rounded-xl border px-5 py-4">
        <div className="flex items-center gap-1.5">
          <span className="size-2 animate-bounce rounded-full bg-violet-400/70 [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-violet-400/70 [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-violet-400/70" />
        </div>

        <div className="bg-muted relative h-1 w-36 overflow-hidden rounded-full">
          <div className="absolute inset-0 animate-[shimmer_2s_infinite] rounded-full bg-gradient-to-r from-violet-500/60 via-violet-400/80 to-violet-500/60 bg-[length:200%_100%]" />
        </div>

        <p
          key={label}
          className="text-muted-foreground animate-[fadeSlideIn_0.4s_ease-out] text-xs"
        >
          {label}
        </p>
      </div>
    </div>
  )
}
