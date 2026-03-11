'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  Expand,
  FileText,
  FolderOpen,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { oodaApi, type AsciipFileDetail, type AsciipFileSummary } from '@/lib/ooda-api'
import { AsciipEditorShell } from '@/components/asciip-core/asciip-editor-shell'
import { initAppState, type AppState } from '@/components/asciip-core/store/appSlice'
import { useAuth } from '@/components/AuthProvider'

function formatAgo(value?: string | null) {
  if (!value) return 'unknown'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function toStableJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {})
  } catch {
    return '{}'
  }
}

function splitAsciipPath(path: string) {
  const segments = path.split('/')
  const fileName = segments.pop() ?? path
  return {
    directory: segments.join('/'),
    fileName,
  }
}

function stripCanvasciiExtension(fileName: string) {
  const lowered = fileName.toLowerCase()
  if (lowered.endsWith('.canvascii')) return fileName.slice(0, -'.canvascii'.length)
  if (lowered.endsWith('.asciip')) return fileName.slice(0, -'.asciip'.length)
  return fileName
}

function ensureCanvasciiExtension(fileName: string) {
  const lowered = fileName.toLowerCase()
  if (lowered.endsWith('.canvascii') || lowered.endsWith('.asciip')) return fileName
  return `${fileName}.canvascii`
}

const SCRATCH_DOCUMENT_ID = '__scratch__'

export function CanvasciiPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const deepLinkedPath = searchParams.get('path')?.trim() || null
  const { isAuthenticated, isLoading } = useAuth()

  const [files, setFiles] = useState<AsciipFileSummary[]>([])
  const [rootPath, setRootPath] = useState<string>('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<AsciipFileDetail | null>(null)
  const [draftState, setDraftState] = useState<AppState | null>(() => initAppState())
  const [query, setQuery] = useState('')

  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autosaving, setAutosaving] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileDirectory, setNewFileDirectory] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const lastAutoSaveKeyRef = useRef<string | null>(null)
  const lastSavedStateKeyRef = useRef<string | null>(null)

  const editorHostRef = useRef<HTMLDivElement | null>(null)

  const savedStateJson = useMemo(() => toStableJson(selectedFile?.editorState ?? {}), [selectedFile?.editorState])
  const draftStateJson = useMemo(() => toStableJson(draftState ?? {}), [draftState])
  const isDirty = Boolean(selectedPath && selectedFile && draftState) && savedStateJson !== draftStateJson
  const isScratchCanvas = !selectedFile

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return files
    return files.filter((file) => `${file.path} ${file.name} ${file.title}`.toLowerCase().includes(needle))
  }, [files, query])

  const selectedSummary = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  )

  const collaboratorUpdateAvailable =
    Boolean(selectedFile && selectedSummary && selectedFile.etag !== selectedSummary.etag) && !isDirty

  const upsertFileSummaryFromDetail = useCallback((detail: AsciipFileDetail, previousPath?: string) => {
    setFiles((current) => {
      const summary: AsciipFileSummary = {
        id: detail.id,
        path: detail.path,
        name: detail.name,
        title: detail.title,
        sizeBytes: detail.sizeBytes,
        revision: detail.revision,
        updatedAt: detail.updatedAt,
        etag: detail.etag,
      }
      const withoutOldPath = previousPath ? current.filter((item) => item.path !== previousPath) : current
      const index = withoutOldPath.findIndex((item) => item.path === detail.path)
      if (index === -1) return [summary, ...withoutOldPath]
      const next = [...withoutOldPath]
      next[index] = summary
      return next
    })
  }, [])

  const updateUrlPathParam = useCallback(
    (nextPath: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextPath) params.set('path', nextPath)
      else params.delete('path')
      const queryString = params.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  async function loadFiles(background = false) {
    if (!isAuthenticated) {
      setFiles([])
      setRootPath('')
      setLoadingFiles(false)
      setRefreshing(false)
      return
    }
    if (background) setRefreshing(true)
    else setLoadingFiles(true)

    try {
      const next = await oodaApi.fetchAsciipFiles({ limit: 1000 })
      setFiles(next.files)
      setRootPath(next.rootPath)

      if (selectedPath && !next.files.some((file) => file.path === selectedPath)) {
        setSelectedPath(null)
        setSelectedFile(null)
        setDraftState(initAppState())
        updateUrlPathParam(null)
      }
      if (!background) setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to load Canvascii files.'
      if (background) {
        setNotice({ tone: 'error', message })
      } else {
        setError(message)
      }
    } finally {
      setLoadingFiles(false)
      setRefreshing(false)
    }
  }

  async function openFile(filePath: string, allowDiscardDirty = false) {
    if (isDirty && filePath !== selectedPath && !allowDiscardDirty) {
      const proceed = window.confirm('You have unsaved changes. Discard them and open another file?')
      if (!proceed) return
    }

    setLoadingFile(true)
    setNotice(null)
    try {
      const detail = await oodaApi.getAsciipFile(filePath)
      setSelectedPath(filePath)
      setSelectedFile(detail)
      setDraftState((detail.editorState as AppState) ?? initAppState())
      setIsLibraryOpen(false)
      updateUrlPathParam(filePath)
      setError(null)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to open file.',
      })
    } finally {
      setLoadingFile(false)
    }
  }

  async function persistEditorState(options: {
    mode: 'manual' | 'auto'
    path: string
    baseEtag: string
    editorState: AppState
  }) {
    const markBusy = options.mode === 'manual' ? setSaving : setAutosaving
    markBusy(true)
    try {
      const updated = await oodaApi.updateAsciipFile({
        path: options.path,
        editorState: options.editorState as unknown as Record<string, unknown>,
        ifMatchEtag: options.baseEtag,
        changeType: options.mode === 'auto' ? 'autosave' : 'commit',
      })
      setSelectedFile(updated)
      upsertFileSummaryFromDetail(updated, options.path)
      const persistedKey = `${options.path}:${toStableJson(options.editorState)}`
      lastSavedStateKeyRef.current = persistedKey
      if (options.mode === 'manual') {
        setNotice({ tone: 'success', message: `Saved ${updated.path}.` })
      }
    } catch (cause) {
      setNotice({
        tone: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : options.mode === 'manual'
              ? 'Failed to save.'
              : 'Autosave failed. Please save manually after reloading.',
      })
    } finally {
      markBusy(false)
    }
  }

  async function handleSave() {
    if (!draftState) return
    if (!isAuthenticated) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (!selectedPath || !selectedFile) {
      setCreateOpen(true)
      return
    }
    setNotice(null)
    await persistEditorState({
      mode: 'manual',
      path: selectedPath,
      baseEtag: selectedFile.etag,
      editorState: draftState,
    })
  }

  async function handleReload() {
    if (!selectedPath) return
    if (isDirty) {
      const proceed = window.confirm('Discard unsaved changes and reload from DB?')
      if (!proceed) return
    }
    await openFile(selectedPath, true)
    await loadFiles(true)
  }

  async function handleCreate() {
    if (!newFileName.trim()) return
    setCreating(true)
    setNotice(null)
    try {
      const created = await oodaApi.createAsciipFile({
        name: newFileName.trim(),
        directory: newFileDirectory.trim() || undefined,
        editorState: (draftState ?? initAppState()) as unknown as Record<string, unknown>,
      })
      setCreateOpen(false)
      setNewFileName('')
      setNewFileDirectory('')
      setNotice({ tone: 'success', message: `Created ${created.path}.` })
      await loadFiles(true)
      await openFile(created.path, true)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to create file.',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleRename() {
    if (!selectedPath || !selectedFile) return
    const cleanName = renameName.trim()
    if (!cleanName) return

    const split = splitAsciipPath(selectedPath)
    const nextFileName = ensureCanvasciiExtension(cleanName)
    const nextPath = split.directory ? `${split.directory}/${nextFileName}` : nextFileName

    setRenaming(true)
    setNotice(null)
    try {
      const updated = await oodaApi.renameAsciipFile({
        path: selectedPath,
        newPath: nextPath,
        title: stripCanvasciiExtension(nextFileName),
        ifMatchEtag: selectedFile.etag,
      })
      setSelectedPath(updated.path)
      setSelectedFile(updated)
      upsertFileSummaryFromDetail(updated, selectedPath)
      updateUrlPathParam(updated.path)
      setRenameOpen(false)
      setNotice({ tone: 'success', message: `Renamed to ${updated.path}.` })
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to rename file.',
      })
    } finally {
      setRenaming(false)
    }
  }

  async function handleDelete() {
    if (!selectedPath) return
    const proceed = window.confirm(`Delete ${selectedPath}? This cannot be undone.`)
    if (!proceed) return

    setDeleting(true)
    setNotice(null)
    try {
      await oodaApi.deleteAsciipFile(selectedPath)
      const deletedPath = selectedPath
      setSelectedPath(null)
      setSelectedFile(null)
      setDraftState(initAppState())
      updateUrlPathParam(null)
      setNotice({ tone: 'success', message: `Deleted ${deletedPath}.` })
      await loadFiles(true)
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to delete file.',
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleCopyDeepLink() {
    if (!selectedPath || typeof window === 'undefined') return
    const params = new URLSearchParams(searchParams.toString())
    params.set('path', selectedPath)
    const deepLink = `${window.location.origin}${pathname}?${params.toString()}`

    try {
      await navigator.clipboard.writeText(deepLink)
      setNotice({ tone: 'success', message: 'Deep link copied.' })
    } catch {
      setNotice({ tone: 'error', message: 'Failed to copy deep link.' })
    }
  }

  async function toggleFullscreen() {
    const host = editorHostRef.current
    if (!host) return
    if (document.fullscreenElement === host) {
      await document.exitFullscreen()
      return
    }
    await host.requestFullscreen()
  }

  function handleResetScratch() {
    const blankStateKey = toStableJson(initAppState())
    if (draftStateJson !== blankStateKey) {
      const proceed = window.confirm('Clear the scratch canvas and start over?')
      if (!proceed) return
    }
    setSelectedPath(null)
    setSelectedFile(null)
    setDraftState(initAppState())
    updateUrlPathParam(null)
    setNotice({ tone: 'info', message: 'Started a new scratch canvas.' })
  }

  useEffect(() => {
    if (!isLoading) {
      void loadFiles()
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (!isAuthenticated) return
    const handle = window.setInterval(() => {
      void loadFiles(true)
    }, 20000)
    return () => window.clearInterval(handle)
  }, [isAuthenticated, selectedPath])

  useEffect(() => {
    if (!isAuthenticated || !deepLinkedPath) return
    if (selectedPath === deepLinkedPath) return
    if (!files.some((file) => file.path === deepLinkedPath)) return
    void openFile(deepLinkedPath, true)
  }, [deepLinkedPath, files, isAuthenticated, selectedPath])

  useEffect(() => {
    if (!isAuthenticated || !autoSaveEnabled) return
    if (!selectedPath || !selectedFile || !draftState) return
    if (savedStateJson === draftStateJson) return
    if (saving || autosaving) return

    const autoSaveKey = `${selectedPath}:${selectedFile.etag}:${draftStateJson}`
    if (lastAutoSaveKeyRef.current === autoSaveKey) return
    if (lastSavedStateKeyRef.current === `${selectedPath}:${draftStateJson}`) return

    const timer = window.setTimeout(() => {
      lastAutoSaveKeyRef.current = autoSaveKey
      void persistEditorState({
        mode: 'auto',
        path: selectedPath,
        baseEtag: selectedFile.etag,
        editorState: draftState,
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [autoSaveEnabled, autosaving, draftState, draftStateJson, isAuthenticated, savedStateJson, saving, selectedFile, selectedPath])

  useEffect(() => {
    const handle = () => {
      setIsFullscreen(document.fullscreenElement === editorHostRef.current)
    }
    document.addEventListener('fullscreenchange', handle)
    return () => document.removeEventListener('fullscreenchange', handle)
  }, [])

  const statusBadge = notice ?? (error ? { tone: 'error' as const, message: error } : null)

  const toolbarLeading = (
    <>
      {isAuthenticated ? (
        <Sheet open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
          <SheetTrigger asChild>
            <Button aria-label="Open file library" size="icon" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100">
              <PanelLeft className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[24rem] border-white/10 bg-[#0b0f15] p-0 text-white sm:max-w-[24rem]">
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-white/10 px-5 py-5 text-left">
                <SheetTitle className="text-white">Canvascii files</SheetTitle>
                <SheetDescription className="text-white/60">
                  {rootPath ? `${visibleFiles.length} file${visibleFiles.length === 1 ? '' : 's'} in ${rootPath}` : 'Saved canvases'}
                </SheetDescription>
              </SheetHeader>
              <div className="border-b border-white/10 px-5 py-4">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search files"
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                />
              </div>
              <div className="flex-1 overflow-auto px-3 py-3">
                {loadingFiles ? (
                  <p className="px-2 py-4 text-sm text-white/60">Loading files...</p>
                ) : visibleFiles.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-white/60">No saved canvases yet.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleFiles.map((file) => {
                      const active = file.path === selectedPath
                      return (
                        <Button
                          key={file.path}
                          type="button"
                          variant="ghost"
                          className={cn(
                            'h-auto w-full items-start justify-start rounded-xl border px-3 py-3 text-left transition-colors',
                            active
                              ? 'border-white/20 bg-white/[0.08]'
                              : 'border-white/8 bg-transparent hover:border-white/16 hover:bg-white/[0.05]',
                          )}
                          onClick={() => void openFile(file.path)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{file.title || file.name}</p>
                              <p className="truncate text-xs text-white/45">{file.path}</p>
                            </div>
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                          </div>
                          <p className="mt-2 text-[11px] text-white/38">
                            rev {file.revision} • {formatAgo(file.updatedAt)} • {Math.max(1, Math.ceil(file.sizeBytes / 1024))} KB
                          </p>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-100">
          {selectedFile ? selectedFile.title || selectedFile.name : 'Canvascii'}
        </div>
        <div className="truncate text-xs text-slate-400">
          {selectedFile
            ? `${selectedFile.path} • rev ${selectedFile.revision}`
            : isAuthenticated
              ? 'Scratch canvas'
              : 'Scratch canvas • sign in to save'}
        </div>
      </div>
      {selectedFile && isDirty ? (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
          Unsaved
        </span>
      ) : null}
      {selectedFile && collaboratorUpdateAvailable ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-200">
          <AlertTriangle className="h-3 w-3" />
          Updated elsewhere
        </span>
      ) : null}
      {statusBadge ? (
        <span
          className={cn(
            'max-w-[28rem] truncate rounded-full border px-2 py-1 text-[11px]',
            statusBadge.tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            statusBadge.tone === 'error' && 'border-red-500/30 bg-red-500/10 text-red-200',
            statusBadge.tone === 'info' && 'border-blue-500/30 bg-blue-500/10 text-blue-200',
          )}
          title={statusBadge.message}
        >
          {statusBadge.message}
        </span>
      ) : null}
    </>
  )

  const toolbarTrailing = isAuthenticated ? (
    <>
      <ButtonGroup className="rounded-xl border border-white/10 bg-black/20 p-1">
        <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100" onClick={() => void toggleFullscreen()}>
          <Expand className="mr-2 h-4 w-4" />
          {isFullscreen ? 'Exit full screen' : 'Full screen'}
        </Button>
        <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100" onClick={() => (selectedFile ? void handleReload() : void loadFiles(true))} disabled={loadingFile || refreshing}>
          <RefreshCw className={cn('mr-2 h-4 w-4', (loadingFile || refreshing) && 'animate-spin')} />
          {selectedFile ? 'Reload' : 'Refresh'}
        </Button>
        <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100" onClick={() => (isScratchCanvas ? setCreateOpen(true) : handleResetScratch())}>
          {isScratchCanvas ? <Plus className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          {isScratchCanvas ? 'New file' : 'New scratch'}
        </Button>
        <Button size="sm" className="bg-slate-50 text-slate-950 hover:bg-white" onClick={() => void handleSave()} disabled={saving || autosaving || !draftState || (selectedFile ? !isDirty : false)}>
          <Save className="mr-2 h-4 w-4" />
          {selectedFile ? (saving ? 'Saving...' : 'Save') : 'Save as file'}
        </Button>
      </ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100" aria-label="More file actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void toggleFullscreen()}>
            <Expand className="mr-2 h-4 w-4" />
            <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </DropdownMenuItem>
          {selectedFile ? (
            <>
              <DropdownMenuItem onSelect={() => void handleCopyDeepLink()}>
                <Copy className="mr-2 h-4 w-4" />
                <span>Copy link</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const sourcePath = selectedPath ?? selectedFile.path
                  const { fileName } = splitAsciipPath(sourcePath)
                  setRenameName(stripCanvasciiExtension(fileName))
                  setRenameOpen(true)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                <span>Rename file</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAutoSaveEnabled((current) => !current)}>
                <Save className="mr-2 h-4 w-4" />
                <span>Auto-save {autoSaveEnabled ? 'on' : 'off'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => void handleDelete()}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete file</span>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Save as file</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleResetScratch}>
                <RotateCcw className="mr-2 h-4 w-4" />
                <span>Clear scratch canvas</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <>
      <Button size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100" onClick={() => void toggleFullscreen()}>
        <Expand className="mr-2 h-4 w-4" />
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </Button>
      <Button asChild size="sm" className="bg-slate-50 text-slate-950 hover:bg-white">
        <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`}>Sign in to save</Link>
      </Button>
      <Button asChild size="sm" variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-slate-100">
        <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open files
        </Link>
      </Button>
    </>
  )

  return (
    <div className="h-[100svh] w-full overflow-hidden bg-[#070a0f] text-white">
      <div ref={editorHostRef} className="h-full w-full overflow-hidden">
        {draftState ? (
          <AsciipEditorShell
            documentId={selectedFile?.id ?? SCRATCH_DOCUMENT_ID}
            editorState={selectedFile?.editorState ?? (draftState as unknown as Record<string, unknown>)}
            onEditorStateChange={(next) => setDraftState(next)}
            toolbarLeading={toolbarLeading}
            toolbarTrailing={toolbarTrailing}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">Preparing canvas...</div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Canvascii File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="canvascii-name">File name</Label>
              <Input
                id="canvascii-name"
                value={newFileName}
                onChange={(event) => setNewFileName(event.target.value)}
                placeholder="wireframe-home"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="canvascii-directory">Directory (optional)</Label>
              <Input
                id="canvascii-directory"
                value={newFileDirectory}
                onChange={(event) => setNewFileDirectory(event.target.value)}
                placeholder="checkout/flows"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating || !newFileName.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Canvascii File</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="canvascii-rename">File name</Label>
            <Input
              id="canvascii-rename"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="wireframe-home"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={renaming || !renameName.trim()}>
              {renaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
