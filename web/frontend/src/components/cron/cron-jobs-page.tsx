import {
  IconClock,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react"
import dayjs from "dayjs"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  type CronJob,
  type CronJobInput,
  type CronSchedule,
  createCronJob,
  deleteCronJob,
  getCronJobs,
  updateCronJob,
} from "@/api/cron"
import { type SessionSummary, getAllSessions } from "@/api/sessions"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

function formatSchedule(s: CronSchedule): string {
  switch (s.kind) {
    case "cron":
      return `cron: ${s.expr ?? ""}${s.tz ? ` (${s.tz})` : ""}`
    case "every":
      return `every ${s.everyMs ? Math.round(s.everyMs / 60000) : 0}m`
    case "at":
      return s.atMs ? `at ${dayjs(s.atMs).format("YYYY-MM-DD HH:mm")}` : "at"
    default:
      return s.kind
  }
}

function emptyForm(): CronJobInput {
  return {
    name: "",
    enabled: true,
    schedule: { kind: "cron", expr: "", tz: "" },
    message: "",
    command: "",
    channel: "",
    to: "",
  }
}

export function CronJobsPage() {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [gatewayDown, setGatewayDown] = useState(false)

  const [editing, setEditing] = useState<CronJob | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CronJobInput>(emptyForm())
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<CronJob | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadJobs = useCallback(async () => {
    setIsLoading(true)
    setGatewayDown(false)
    try {
      const data = await getCronJobs()
      setJobs(data)
      setLoadError(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("503")) {
        setGatewayDown(true)
      } else {
        setLoadError(true)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const openCreate = useCallback(async () => {
    setEditing(null)
    setForm(emptyForm())
    try {
      setSessions(await getAllSessions(0, 100))
    } catch {
      setSessions([])
    }
    setFormOpen(true)
  }, [])

  const openEdit = useCallback(async (job: CronJob) => {
    setEditing(job)
    setForm({
      name: job.name,
      enabled: job.enabled,
      schedule: job.schedule,
      message: job.payload.message,
      command: job.payload.command ?? "",
      channel: job.payload.channel ?? "",
      to: job.payload.to ?? "",
    })
    try {
      setSessions(await getAllSessions(0, 100))
    } catch {
      setSessions([])
    }
    setFormOpen(true)
  }, [])

  const handleSessionPick = (id: string) => {
    const session = sessions.find((s) => s.id === id)
    if (!session) return
    setForm((prev) => ({
      ...prev,
      channel: session.channel ?? "",
      to: session.id,
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("cron.nameRequired"))
      return
    }
    if (form.schedule.kind === "cron" && !form.schedule.expr?.trim()) {
      toast.error(t("cron.exprRequired"))
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCronJob(editing.id, form)
      } else {
        await createCronJob(form)
      }
      setFormOpen(false)
      await loadJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cron.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (job: CronJob) => {
    try {
      await updateCronJob(job.id, { ...toInput(job), enabled: !job.enabled })
      await loadJobs()
    } catch {
      toast.error(
        job.enabled ? t("cron.disableFailed") : t("cron.enableFailed"),
      )
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteCronJob(pendingDelete.id)
      setJobs((prev) => prev.filter((j) => j.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch {
      toast.error(t("cron.deleteFailed"))
    } finally {
      setIsDeleting(false)
    }
  }

  const setSchedule = (patch: Partial<CronSchedule>) =>
    setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }))

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("navigation.cron_jobs")}
        children={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadJobs()}
              disabled={isLoading}
            >
              <IconRefresh className="size-4" />
              {t("cron.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void openCreate()}
              disabled={gatewayDown}
            >
              <IconPlus className="size-4" />
              {t("cron.add")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-8">
        {gatewayDown && (
          <div className="bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
            {t("cron.gatewayUnavailable")}
          </div>
        )}

        <div className="bg-background overflow-hidden rounded-xl border">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">{t("cron.name")}</th>
                  <th className="px-4 py-3 font-medium">
                    {t("cron.schedule")}
                  </th>
                  <th className="w-44 px-4 py-3 font-medium">
                    {t("cron.session")}
                  </th>
                  <th className="w-20 px-4 py-3 font-medium">
                    {t("cron.enabled")}
                  </th>
                  <th className="w-36 px-4 py-3 font-medium">
                    {t("cron.nextRun")}
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 && !loadError && !gatewayDown && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-muted-foreground px-4 py-10 text-center"
                    >
                      {isLoading ? t("cron.loading") : t("cron.empty")}
                    </td>
                  </tr>
                )}
                {loadError && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-destructive px-4 py-10 text-center"
                    >
                      {t("cron.loadFailed")}
                    </td>
                  </tr>
                )}
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-accent/50 border-t">
                    <td className="max-w-0 px-4 py-3">
                      <div className="line-clamp-1 font-medium">{job.name}</div>
                      {job.payload.command ? (
                        <div className="text-muted-foreground line-clamp-1 font-mono text-xs">
                          {job.payload.command}
                        </div>
                      ) : (
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {job.payload.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {formatSchedule(job.schedule)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <div>{job.payload.channel || "—"}</div>
                        <div className="text-muted-foreground">
                          {job.payload.to}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={job.enabled}
                        disabled={gatewayDown}
                        onCheckedChange={() => void handleToggle(job)}
                        aria-label={t("cron.enabled")}
                      />
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {job.state.nextRunAtMs ? (
                        <span
                          title={dayjs(job.state.nextRunAtMs).format("LLL")}
                        >
                          {dayjs(job.state.nextRunAtMs).fromNow()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("cron.edit")}
                          onClick={() => void openEdit(job)}
                          disabled={gatewayDown}
                        >
                          <IconEdit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("cron.delete")}
                          className="hover:text-destructive"
                          onClick={() => setPendingDelete(job)}
                          disabled={gatewayDown}
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconClock className="size-5" />
              {editing ? t("cron.edit") : t("cron.add")}
            </DialogTitle>
            <DialogDescription>{t("cron.formHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cron-name">{t("cron.name")}</Label>
              <Input
                id="cron-name"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder={t("cron.namePlaceholder")}
              />
            </div>

            <div className="space-y-1">
              <Label>{t("cron.kind")}</Label>
              <Select
                value={form.schedule.kind}
                onValueChange={(v) =>
                  setSchedule({ kind: v as CronSchedule["kind"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cron">{t("cron.kindCron")}</SelectItem>
                  <SelectItem value="every">{t("cron.kindEvery")}</SelectItem>
                  <SelectItem value="at">{t("cron.kindAt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.schedule.kind === "cron" && (
              <div className="space-y-1">
                <Label htmlFor="cron-expr">{t("cron.cronExpr")}</Label>
                <Input
                  id="cron-expr"
                  value={form.schedule.expr ?? ""}
                  onChange={(e) => setSchedule({ expr: e.target.value })}
                  placeholder="*/5 * * * *"
                  className="font-mono"
                />
                <Input
                  className="mt-1"
                  value={form.schedule.tz ?? ""}
                  onChange={(e) => setSchedule({ tz: e.target.value })}
                  placeholder={t("cron.timezonePlaceholder")}
                />
              </div>
            )}

            {form.schedule.kind === "every" && (
              <div className="space-y-1">
                <Label htmlFor="cron-every">{t("cron.intervalMinutes")}</Label>
                <Input
                  id="cron-every"
                  type="number"
                  min={1}
                  value={
                    form.schedule.everyMs
                      ? Math.round(form.schedule.everyMs / 60000)
                      : 5
                  }
                  onChange={(e) =>
                    setSchedule({
                      everyMs: Math.max(1, Number(e.target.value) || 1) * 60000,
                    })
                  }
                />
              </div>
            )}

            {form.schedule.kind === "at" && (
              <div className="space-y-1">
                <Label htmlFor="cron-at">{t("cron.atTime")}</Label>
                <Input
                  id="cron-at"
                  type="datetime-local"
                  value={
                    form.schedule.atMs
                      ? dayjs(form.schedule.atMs).format("YYYY-MM-DDTHH:mm")
                      : ""
                  }
                  onChange={(e) =>
                    setSchedule({
                      atMs: e.target.value
                        ? new Date(e.target.value).getTime()
                        : undefined,
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="cron-message">{t("cron.message")}</Label>
              <Textarea
                id="cron-message"
                value={form.message}
                onChange={(e) =>
                  setForm((p) => ({ ...p, message: e.target.value }))
                }
                placeholder={t("cron.messagePlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cron-command">{t("cron.command")}</Label>
              <Input
                id="cron-command"
                value={form.command ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, command: e.target.value }))
                }
                placeholder={t("cron.commandPlaceholder")}
                className="font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label>{t("cron.session")}</Label>
              <Select value="" onValueChange={handleSessionPick}>
                <SelectTrigger>
                  <SelectValue placeholder={t("cron.sessionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cron-channel">{t("cron.channel")}</Label>
                <Input
                  id="cron-channel"
                  value={form.channel ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, channel: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cron-to">{t("cron.to")}</Label>
                <Input
                  id="cron-to"
                  value={form.to ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, to: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
              />
              <Label>{t("cron.enabled")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {editing ? t("cron.update") : t("cron.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cron.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cron.deleteDescription", { name: pendingDelete?.name ?? "" })}
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
              {t("cron.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function toInput(job: CronJob): CronJobInput {
  return {
    name: job.name,
    enabled: job.enabled,
    schedule: job.schedule,
    message: job.payload.message,
    command: job.payload.command ?? "",
    channel: job.payload.channel ?? "",
    to: job.payload.to ?? "",
  }
}
