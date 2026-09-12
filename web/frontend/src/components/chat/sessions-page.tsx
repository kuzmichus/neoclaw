import {
  IconFileText,
  IconHistory,
  IconMessageCircle,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import dayjs from "dayjs"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  type SessionPrompt,
  type SessionSummary,
  deleteSession,
  getAllSessions,
  getSessionPrompt,
} from "@/api/sessions"
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { switchChatSession } from "@/features/chat/controller"

const PAGE_SIZE = 20

export function SessionsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const [promptSession, setPromptSession] = useState<SessionSummary | null>(
    null,
  )
  const [promptData, setPromptData] = useState<SessionPrompt | null>(null)
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false)

  const loadSessions = useCallback(
    async (reset: boolean) => {
      setIsLoading(true)
      try {
        const currentOffset = reset ? 0 : offset
        const data = await getAllSessions(currentOffset, PAGE_SIZE)
        setHasMore(data.length >= PAGE_SIZE)
        setSessions((prev) =>
          reset
            ? data
            : [
                ...prev.filter(
                  (item) => !data.some((fresh) => fresh.id === item.id),
                ),
                ...data,
              ],
        )
        setOffset(reset ? data.length : currentOffset + data.length)
        setLoadError(false)
      } catch {
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    },
    [offset],
  )

  useEffect(() => {
    void loadSessions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenSession = async (sessionId: string) => {
    try {
      await switchChatSession(sessionId)
      await navigate({ to: "/" })
    } catch {
      toast.error(t("sessions.openFailed"))
    }
  }

  const handleViewPrompt = async (session: SessionSummary) => {
    setPromptSession(session)
    setPromptData(null)
    setIsLoadingPrompt(true)
    try {
      const data = await getSessionPrompt(session.id)
      setPromptData(data)
    } catch {
      toast.error(t("sessions.promptFailed"))
    } finally {
      setIsLoadingPrompt(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteSession(pendingDelete.id)
      setSessions((prev) => prev.filter((item) => item.id !== pendingDelete.id))
      setOffset((prev) => Math.max(prev - 1, 0))
      setPendingDelete(null)
    } catch {
      toast.error(t("sessions.deleteFailed"))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("navigation.sessions")}
        children={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSessions(true)}
            disabled={isLoading}
          >
            <IconRefresh className="size-4" />
            {t("sessions.refresh")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-8">
        <div className="bg-background overflow-hidden rounded-xl border">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">
                    {t("sessions.startPhrase")}
                  </th>
                  <th className="w-28 px-4 py-3 font-medium">
                    {t("sessions.channel")}
                  </th>
                  <th className="w-24 px-4 py-3 font-medium">
                    {t("sessions.messages")}
                  </th>
                  <th className="w-36 px-4 py-3 font-medium">
                    {t("sessions.updated")}
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && !loadError && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-muted-foreground px-4 py-10 text-center"
                    >
                      {isLoading ? t("sessions.loading") : t("sessions.empty")}
                    </td>
                  </tr>
                )}
                {loadError && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-destructive px-4 py-10 text-center"
                    >
                      {t("sessions.loadFailed")}
                    </td>
                  </tr>
                )}
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-accent/50 cursor-pointer border-t transition-colors"
                    onClick={() => void handleOpenSession(session.id)}
                  >
                    <td className="max-w-0 px-4 py-3">
                      <span className="line-clamp-2">{session.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {session.channel || t("sessions.unknownChannel")}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {session.message_count}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      <span title={session.updated}>
                        {dayjs(session.updated).fromNow()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("sessions.viewPrompt")}
                          title={t("sessions.viewPrompt")}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleViewPrompt(session)
                          }}
                        >
                          <IconFileText className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("sessions.openInChat")}
                          title={t("sessions.openInChat")}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleOpenSession(session.id)
                          }}
                        >
                          <IconMessageCircle className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("chat.deleteSession")}
                          title={t("chat.deleteSession")}
                          className="hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingDelete(session)
                          }}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasMore && sessions.length > 0 && (
              <div className="flex justify-center border-t py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadSessions(false)}
                  disabled={isLoading}
                >
                  <IconHistory className="size-4" />
                  {isLoading ? t("sessions.loading") : t("sessions.loadMore")}
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sessions.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sessions.deleteDescription", {
                phrase: pendingDelete?.title ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {t("chat.deleteSession")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={promptSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPromptSession(null)
          }
        }}
      >
        <DialogContent className="!flex max-h-[90vh] !w-[95vw] !max-w-[1600px] flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("sessions.promptTitle")}</DialogTitle>
            <DialogDescription>{promptSession?.title}</DialogDescription>
          </DialogHeader>
          {isLoadingPrompt ? (
            <div className="text-muted-foreground py-8 text-center">
              {t("sessions.loading")}
            </div>
          ) : promptData ? (
            <ScrollArea className="min-h-0 flex-1 overflow-x-hidden pr-3">
              <div className="flex flex-col gap-3">
                {promptData.messages.map((msg, i) => (
                  <div key={i} className="min-w-0 rounded-lg border p-3">
                    <Badge variant="secondary" className="mb-2">
                      {msg.role}
                    </Badge>
                    <pre className="min-w-0 text-xs break-words whitespace-pre-wrap">
                      {msg.content}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-destructive py-8 text-center">
              {t("sessions.promptFailed")}
            </div>
          )}
          {promptData?.note && (
            <p className="text-muted-foreground text-xs">{promptData.note}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
