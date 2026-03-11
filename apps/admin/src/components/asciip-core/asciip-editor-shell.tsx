'use client'

import { useMemo, useRef, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import App from './components/App'
import { initAppState, type AppState } from './store/appSlice'
import { createAsciipStore } from './store/store'
import { defaultStyle } from './models/style'
import { TooltipProvider } from '@/components/ui/tooltip'

function asAppState(value: unknown): AppState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<AppState>
  if (!Array.isArray(candidate.diagrams)) return null
  if (typeof candidate.activeDiagramId !== 'string') return null

  const baselineStyle = defaultStyle()
  const normalized: AppState = {
    ...(candidate as AppState),
    diagrams: candidate.diagrams.map((diagram) => {
      const currentStyle = diagram.data?.globalStyle ?? baselineStyle
      return {
        ...diagram,
        data: {
          ...diagram.data,
          styleMode: diagram.data?.styleMode ?? 'UNICODE',
          globalStyle: {
            ...baselineStyle,
            ...currentStyle,
            arrowStartHead: false,
            arrowEndHead: false,
          },
        },
      }
    }),
  }

  return normalized
}

export function AsciipEditorShell({
  documentId,
  editorState,
  onEditorStateChange,
  toolbarLeading,
  toolbarTrailing,
}: {
  documentId: string
  editorState: Record<string, unknown> | null
  onEditorStateChange: (next: AppState) => void
  toolbarLeading?: ReactNode
  toolbarTrailing?: ReactNode
}) {
  const initialState = useMemo(() => asAppState(editorState) ?? initAppState(), [documentId])
  const persistRef = useRef(onEditorStateChange)
  persistRef.current = onEditorStateChange

  const store = useMemo(
    () =>
      createAsciipStore({
        initialAppState: initialState,
        onPersistState: (next) => persistRef.current(next),
      }),
    [documentId, initialState],
  )

  return (
    <Provider store={store}>
      <TooltipProvider delayDuration={150}>
        <App toolbarLeading={toolbarLeading} toolbarTrailing={toolbarTrailing} />
      </TooltipProvider>
    </Provider>
  )
}
