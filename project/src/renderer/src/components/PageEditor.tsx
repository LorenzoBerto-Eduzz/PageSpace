import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  PageContent,
  PageEditorData,
  PageSummary,
  TitleElement
} from '../../../shared/page-contracts'
import {
  ArrowLeftIcon,
  EyeIcon,
  MoveIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SettingsIcon,
  TrashIcon
} from './icons'
import { ModalCloseButton } from './ModalCloseButton'

type PageEditorProps = {
  pageId: string
  onBack: () => void
  onSaved: (data: PageEditorData) => void
  onOpenSettings: (pageId: string, hasUnsavedChanges: boolean) => void
}

type PanelPosition = {
  x: number
  y: number
}

type ExitIntent = 'dashboard' | 'window' | null

type ElementDragPreview = {
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
  text: string
}

const PANEL_WIDTH = 320
const PANEL_MARGIN = 24
const DEFAULT_GAP = 48
const MIN_GAP = 0
const MIN_SIDE_MARGIN = 20
const MIN_CONTENT_WIDTH = 240

function initialPanelPosition(): PanelPosition {
  return {
    x: Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
    y: PANEL_MARGIN
  }
}

function cloneContent(content: PageContent): PageContent {
  return {
    schemaVersion: 2,
    elements: content.elements.map((element) => ({ ...element })),
    layout: {
      marginLeft: content.layout.marginLeft,
      marginRight: content.layout.marginRight,
      gaps: [...content.layout.gaps]
    }
  }
}

function contentFingerprint(content: PageContent | null): string {
  return content ? JSON.stringify(content) : ''
}

export function PageEditor({
  pageId,
  onBack,
  onSaved,
  onOpenSettings
}: PageEditorProps): React.JSX.Element {
  const [content, setContent] = useState<PageContent | null>(null)
  const [savedContent, setSavedContent] = useState<PageContent | null>(null)
  const [page, setPage] = useState<PageSummary | null>(null)
  const [position, setPosition] = useState<PanelPosition>(initialPanelPosition)
  const [isViewing, setIsViewing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [exitIntent, setExitIntent] = useState<ExitIntent>(null)
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null)
  const [elementDragPreview, setElementDragPreview] = useState<ElementDragPreview | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const elementDragPreviewRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef<PanelPosition | null>(null)
  const latestElementDragPosition = useRef<{ x: number; y: number } | null>(null)
  const elementDragGesture = useRef<{
    elementId: string
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    width: number
    text: string
    active: boolean
  } | null>(null)
  const allowWindowClose = useRef(false)

  const isDirty = useMemo(
    () => contentFingerprint(content) !== contentFingerprint(savedContent),
    [content, savedContent]
  )

  useEffect(() => {
    let isCurrent = true

    window.pageSpace
      .getPage(pageId)
      .then((loadedPage) => {
        if (!isCurrent) return
        if (loadedPage.kind !== 'simple') {
          throw new Error('Esta página usa um editor definido por pacote.')
        }
        setPage(loadedPage.page)
        setContent(cloneContent(loadedPage.content))
        setSavedContent(cloneContent(loadedPage.content))
      })
      .catch(() => {
        if (isCurrent) setSaveError('Não foi possível abrir a página.')
      })

    return () => {
      isCurrent = false
    }
  }, [pageId])

  useEffect(() => {
    function warnBeforeClosing(event: BeforeUnloadEvent): void {
      if (!isDirty || allowWindowClose.current) return
      event.preventDefault()
      event.returnValue = ''
      setExitIntent('window')
    }

    window.addEventListener('beforeunload', warnBeforeClosing)
    return () => window.removeEventListener('beforeunload', warnBeforeClosing)
  }, [isDirty])

  function startDragging(event: React.PointerEvent<HTMLDivElement>): void {
    if (
      event.button !== 0 ||
      isViewing ||
      (event.target instanceof Element &&
        event.target.closest('button, a, input, textarea, select'))
    ) {
      return
    }
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function drag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragOffset.current) return

    const panelHeight = panelRef.current?.offsetHeight ?? 280
    const maximumX = Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN)
    const maximumY = Math.max(PANEL_MARGIN, window.innerHeight - panelHeight - PANEL_MARGIN)

    setPosition({
      x: Math.min(maximumX, Math.max(PANEL_MARGIN, event.clientX - dragOffset.current.x)),
      y: Math.min(maximumY, Math.max(PANEL_MARGIN, event.clientY - dragOffset.current.y))
    })
  }

  function updateContent(transform: (current: PageContent) => PageContent): void {
    setSaveError(null)
    setContent((current) => (current ? transform(current) : current))
  }

  function updateTitle(elementId: string, text: string): void {
    const singleLineText = text.replace(/[\r\n]+/g, ' ').slice(0, 120)
    updateContent((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === elementId ? { ...element, text: singleLineText } : element
      )
    }))
  }

  function addTitle(): void {
    updateContent((current) => {
      const newElement: TitleElement = {
        id: crypto.randomUUID(),
        type: 'title',
        text: 'Novo título'
      }
      const gaps = [...current.layout.gaps]
      if (current.elements.length === 0) {
        gaps.splice(0, gaps.length, DEFAULT_GAP, DEFAULT_GAP)
      } else {
        gaps[gaps.length - 1] = DEFAULT_GAP
        gaps.push(DEFAULT_GAP)
      }

      return {
        ...current,
        elements: [...current.elements, newElement],
        layout: { ...current.layout, gaps }
      }
    })
  }

  function deleteElement(elementId: string): void {
    updateContent((current) => {
      const index = current.elements.findIndex((element) => element.id === elementId)
      if (index < 0) return current

      const gaps = [...current.layout.gaps]
      const mergedGap = Math.max(gaps[index] ?? DEFAULT_GAP, gaps[index + 1] ?? DEFAULT_GAP)
      gaps.splice(index, 2, mergedGap)

      return {
        ...current,
        elements: current.elements.filter((element) => element.id !== elementId),
        layout: { ...current.layout, gaps }
      }
    })
  }

  function moveElementToIndex(insertionIndex: number): void {
    if (!draggedElementId) return
    updateContent((current) => {
      const sourceIndex = current.elements.findIndex((element) => element.id === draggedElementId)
      if (sourceIndex < 0) return current

      const elements = [...current.elements]
      const [movedElement] = elements.splice(sourceIndex, 1)
      const adjustedIndex = Math.min(
        elements.length,
        Math.max(0, insertionIndex - (sourceIndex < insertionIndex ? 1 : 0))
      )
      elements.splice(adjustedIndex, 0, movedElement)
      return { ...current, elements }
    })
    setDraggedElementId(null)
  }

  function insertionIndexAt(clientY: number): number {
    const elementNodes = Array.from(
      document.querySelectorAll<HTMLElement>('.page-element[data-element-index]')
    )
    const bounds = elementNodes.map((node) => node.getBoundingClientRect())
    if (bounds.length === 0 || clientY <= bounds[0].bottom) return 0

    for (let index = 0; index < bounds.length - 1; index += 1) {
      const current = bounds[index]
      const next = bounds[index + 1]
      const gapMiddle = current.bottom + (next.top - current.bottom) / 2
      if (clientY < next.top) return clientY <= gapMiddle ? index : index + 1
      if (clientY <= next.bottom) return index + 1
    }

    return clientY <= bounds[bounds.length - 1].bottom ? bounds.length - 1 : bounds.length
  }

  function positionElementDragPreview(): void {
    const preview = elementDragPreviewRef.current
    const position = latestElementDragPosition.current
    const gesture = elementDragGesture.current
    if (!preview || !position || !gesture) return

    preview.style.transform = `translate(${position.x - gesture.offsetX}px, ${
      position.y - gesture.offsetY
    }px)`
  }

  function updateGap(index: number, gap: number): void {
    updateContent((current) => {
      const gaps = [...current.layout.gaps]
      gaps[index] = Math.min(480, Math.max(MIN_GAP, Math.round(gap)))
      return { ...current, layout: { ...current.layout, gaps } }
    })
  }

  function updateSideMargin(side: 'left' | 'right', margin: number): void {
    updateContent((current) => {
      const oppositeMargin =
        side === 'left' ? current.layout.marginRight : current.layout.marginLeft
      const maximumMargin = Math.max(
        MIN_SIDE_MARGIN,
        window.innerWidth - oppositeMargin - MIN_CONTENT_WIDTH
      )
      return {
        ...current,
        layout: {
          ...current.layout,
          [side === 'left' ? 'marginLeft' : 'marginRight']: Math.min(
            maximumMargin,
            Math.max(MIN_SIDE_MARGIN, Math.round(margin))
          )
        }
      }
    })
  }

  async function save(): Promise<boolean> {
    if (!content || !isDirty || isSaving) return true

    setIsSaving(true)
    setSaveError(null)
    try {
      const savedPage = await window.pageSpace.savePageContent({ pageId, content })
      if (savedPage.kind !== 'simple') {
        throw new Error('O PageSpace não retornou o conteúdo simples salvo.')
      }
      setPage(savedPage.page)
      setContent(cloneContent(savedPage.content))
      setSavedContent(cloneContent(savedPage.content))
      let previewDataUrl = savedPage.page.previewDataUrl
      try {
        previewDataUrl = await window.pageSpace.capturePagePreview(pageId)
      } catch {
        setSaveError('A página foi salva, mas não foi possível atualizar sua imagem.')
      }
      let completedSave: Extract<PageEditorData, { kind: 'simple' }> = {
        ...savedPage,
        page: {
          ...savedPage.page,
          ...(previewDataUrl ? { previewDataUrl } : {})
        }
      }
      if (savedPage.page.status === 'published') {
        try {
          const published = await window.pageSpace.publishPage({ pageId })
          completedSave = { ...completedSave, page: published.page }
          setPage(published.page)
        } catch (publishError) {
          try {
            const currentPage = (await window.pageSpace.getPage(pageId)).page
            completedSave = { ...completedSave, page: currentPage }
            setPage(currentPage)
          } catch {
            // Keep the local save result if refreshing publication state also fails.
          }
          setSaveError(
            publishError instanceof Error
              ? publishError.message
              : 'A página foi salva localmente, mas não foi publicada.'
          )
        }
      }
      onSaved(completedSave)
      return true
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a página.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function requestBack(): void {
    if (isDirty) {
      setExitIntent('dashboard')
    } else {
      onBack()
    }
  }

  async function saveAndExit(): Promise<void> {
    if (!(await save())) return
    completeExit()
  }

  function discardAndExit(): void {
    completeExit()
  }

  function completeExit(): void {
    const intendedExit = exitIntent
    setExitIntent(null)
    if (intendedExit === 'window') {
      allowWindowClose.current = true
      window.close()
    } else {
      onBack()
    }
  }

  return (
    <main
      className={[
        'page-editor',
        isViewing ? 'page-editor--viewing' : '',
        draggedElementId ? 'page-editor--dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {content ? (
        <article
          className="public-page"
          aria-label="Página em edição"
          style={
            {
              paddingLeft: content.layout.marginLeft,
              paddingRight: content.layout.marginRight,
              '--page-margin-left': `${content.layout.marginLeft}px`,
              '--page-margin-right': `${content.layout.marginRight}px`
            } as React.CSSProperties
          }
        >
          {!isViewing ? (
            <>
              <SideMarginControl
                side="left"
                margin={content.layout.marginLeft}
                topGap={content.layout.gaps[0]}
                onChange={(margin) => updateSideMargin('left', margin)}
              />
              <SideMarginControl
                side="right"
                margin={content.layout.marginRight}
                topGap={content.layout.gaps[0]}
                onChange={(margin) => updateSideMargin('right', margin)}
              />
            </>
          ) : null}

          <div className="page-elements">
            {content.elements.map((element, index) => (
              <div className="element-sequence" key={element.id}>
                <GapControl
                  gap={content.layout.gaps[index]}
                  isViewing={isViewing}
                  isElementDragging={Boolean(draggedElementId)}
                  isFirst={index === 0}
                  onChange={(gap) => updateGap(index, gap)}
                  onDropStart={() => moveElementToIndex(index === 0 ? 0 : index - 1)}
                  onDropEnd={() => moveElementToIndex(index)}
                />
                <div
                  className={
                    draggedElementId === element.id
                      ? 'page-element page-element--title page-element--dragging'
                      : 'page-element page-element--title'
                  }
                  data-element-index={index}
                >
                  {!isViewing ? (
                    <div className="element-actions">
                      <button
                        className="element-action element-move-action"
                        type="button"
                        aria-label="Mover título"
                        onPointerDown={(event) => {
                          if (event.button !== 0) return
                          const elementNode =
                            event.currentTarget.closest<HTMLElement>('.page-element')
                          if (!elementNode) return
                          const bounds = elementNode.getBoundingClientRect()
                          elementDragGesture.current = {
                            elementId: element.id,
                            startX: event.clientX,
                            startY: event.clientY,
                            offsetX: event.clientX - bounds.left,
                            offsetY: event.clientY - bounds.top,
                            width: bounds.width,
                            text: element.text,
                            active: false
                          }
                          event.currentTarget.setPointerCapture(event.pointerId)
                        }}
                        onPointerMove={(event) => {
                          const gesture = elementDragGesture.current
                          if (!gesture) return
                          const distance = Math.hypot(
                            event.clientX - gesture.startX,
                            event.clientY - gesture.startY
                          )
                          if (!gesture.active && distance < 4) return
                          latestElementDragPosition.current = {
                            x: event.clientX,
                            y: event.clientY
                          }
                          if (!gesture.active) {
                            gesture.active = true
                            setDraggedElementId(gesture.elementId)
                            setElementDragPreview({
                              x: event.clientX,
                              y: event.clientY,
                              offsetX: gesture.offsetX,
                              offsetY: gesture.offsetY,
                              width: gesture.width,
                              text: gesture.text
                            })
                            requestAnimationFrame(positionElementDragPreview)
                          } else {
                            positionElementDragPreview()
                          }
                        }}
                        onPointerUp={(event) => {
                          const gesture = elementDragGesture.current
                          if (gesture?.active) {
                            moveElementToIndex(insertionIndexAt(event.clientY))
                          }
                          elementDragGesture.current = null
                          latestElementDragPosition.current = null
                          setElementDragPreview(null)
                          setDraggedElementId(null)
                          event.currentTarget.blur()
                        }}
                        onPointerCancel={(event) => {
                          elementDragGesture.current = null
                          latestElementDragPosition.current = null
                          setElementDragPreview(null)
                          setDraggedElementId(null)
                          event.currentTarget.blur()
                        }}
                      >
                        <MoveIcon size={16} />
                      </button>
                      <button
                        className="element-action"
                        type="button"
                        aria-label="Configurar título"
                      >
                        <SettingsIcon size={16} />
                      </button>
                      <button
                        className="element-action"
                        type="button"
                        aria-label="Excluir título"
                        onClick={() => deleteElement(element.id)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ) : null}
                  <EditableTitle
                    text={element.text}
                    isViewing={isViewing}
                    onChange={(text) => updateTitle(element.id, text)}
                  />
                </div>
              </div>
            ))}
            <GapControl
              gap={content.layout.gaps[content.elements.length]}
              isViewing={isViewing}
              isElementDragging={Boolean(draggedElementId)}
              isFirst={content.elements.length === 0}
              onChange={(gap) => updateGap(content.elements.length, gap)}
              onDropStart={() => moveElementToIndex(Math.max(0, content.elements.length - 1))}
              onDropEnd={() => moveElementToIndex(content.elements.length)}
            />
          </div>
        </article>
      ) : null}

      <aside
        ref={panelRef}
        className={isViewing ? 'editor-panel editor-panel--viewing' : 'editor-panel'}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        aria-label="Painel de edição"
        onPointerDown={startDragging}
        onPointerMove={drag}
        onPointerUp={() => {
          dragOffset.current = null
        }}
        onPointerCancel={() => {
          dragOffset.current = null
        }}
      >
        {!isViewing ? (
          <>
            <button
              className="editor-panel-action editor-back-action"
              type="button"
              aria-label="Voltar para Minhas Páginas"
              onClick={requestBack}
            >
              <ArrowLeftIcon size={24} />
            </button>
            <button
              className="editor-panel-action editor-add-action"
              type="button"
              aria-label="Adicionar título"
              onClick={addTitle}
            >
              <PlusIcon size={24} />
            </button>
            <button
              className="editor-panel-action editor-settings-action"
              type="button"
              aria-label="Configurações da página"
              onClick={() => onOpenSettings(pageId, isDirty)}
            >
              <SettingsIcon size={24} />
            </button>
            <button
              className="editor-panel-action editor-save-action"
              type="button"
              aria-label={page?.status === 'published' ? 'Salvar e postar página' : 'Salvar página'}
              disabled={!isDirty || isSaving}
              onClick={save}
            >
              <SaveIcon size={23} />
            </button>
          </>
        ) : null}
        <button
          className="editor-panel-action editor-view-toggle"
          type="button"
          aria-label={isViewing ? 'Voltar à edição' : 'Visualizar página'}
          aria-pressed={isViewing}
          onClick={() => setIsViewing((currentValue) => !currentValue)}
        >
          {isViewing ? <PencilIcon size={24} /> : <EyeIcon size={24} />}
        </button>
        {saveError && !isViewing ? <p className="editor-save-error">{saveError}</p> : null}
        <span className="visually-hidden">Arraste para mover o painel</span>
      </aside>

      {elementDragPreview ? (
        <div
          ref={elementDragPreviewRef}
          className="element-drag-preview"
          style={{
            width: elementDragPreview.width,
            transform: `translate(${elementDragPreview.x - elementDragPreview.offsetX}px, ${
              elementDragPreview.y - elementDragPreview.offsetY
            }px)`
          }}
        >
          <div className="element-drag-preview-actions">
            <span className="element-action">
              <MoveIcon size={16} />
            </span>
            <span className="element-action">
              <SettingsIcon size={16} />
            </span>
            <span className="element-action">
              <TrashIcon size={16} />
            </span>
          </div>
          <h1>{elementDragPreview.text}</h1>
        </div>
      ) : null}

      {exitIntent ? (
        <UnsavedChangesDialog
          isSaving={isSaving}
          onContinue={() => setExitIntent(null)}
          onDiscard={discardAndExit}
          onSave={saveAndExit}
        />
      ) : null}
    </main>
  )
}

type EditableTitleProps = {
  text: string
  isViewing: boolean
  onChange: (text: string) => void
}

function EditableTitle({ text, isViewing, onChange }: EditableTitleProps): React.JSX.Element {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const title = titleRef.current
    if (title && title.textContent !== text && document.activeElement !== title) {
      title.textContent = text
    }
  }, [text])

  return (
    <h1
      ref={titleRef}
      contentEditable={!isViewing}
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault()
      }}
      onPaste={(event) => {
        event.preventDefault()
        const pastedText = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')
        document.execCommand('insertText', false, pastedText)
      }}
    />
  )
}

type GapControlProps = {
  gap: number
  isViewing: boolean
  isElementDragging: boolean
  isFirst: boolean
  onChange: (gap: number) => void
  onDropStart: () => void
  onDropEnd: () => void
}

function GapControl({
  gap,
  isViewing,
  isElementDragging,
  isFirst,
  onChange,
  onDropStart,
  onDropEnd
}: GapControlProps): React.JSX.Element {
  return (
    <div
      className={[
        'layout-gap',
        isViewing ? 'layout-gap--viewing' : '',
        isFirst ? 'layout-gap--first' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ height: gap }}
    >
      {!isViewing ? (
        <>
          <GapDropZone half="start" isElementDragging={isElementDragging} onDrop={onDropStart} />
          <GapDropZone half="end" isElementDragging={isElementDragging} onDrop={onDropEnd} />
          <GapEdge edge="start" gap={gap} onChange={onChange} />
          <GapEdge edge="end" gap={gap} onChange={onChange} />
        </>
      ) : null}
    </div>
  )
}

type GapEdgeProps = {
  edge: 'start' | 'end'
  gap: number
  onChange: (gap: number) => void
}

function GapEdge({ edge, gap, onChange }: GapEdgeProps): React.JSX.Element {
  const dragStart = useRef<{ y: number; gap: number } | null>(null)

  return (
    <span
      className={`layout-gap-edge layout-gap-edge--${edge}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragStart.current = { y: event.clientY, gap }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!dragStart.current) return
        const movement = event.clientY - dragStart.current.y
        onChange(dragStart.current.gap + (edge === 'end' ? movement : -movement))
      }}
      onPointerUp={() => {
        dragStart.current = null
      }}
      onPointerCancel={() => {
        dragStart.current = null
      }}
    />
  )
}

type GapDropZoneProps = {
  half: 'start' | 'end'
  isElementDragging: boolean
  onDrop: () => void
}

function GapDropZone({ half, isElementDragging, onDrop }: GapDropZoneProps): React.JSX.Element {
  return (
    <span
      className={`layout-gap-drop-zone layout-gap-drop-zone--${half}`}
      onDragOver={(event) => {
        if (isElementDragging) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop()
      }}
    />
  )
}

type SideMarginControlProps = {
  side: 'left' | 'right'
  margin: number
  topGap: number
  onChange: (margin: number) => void
}

function SideMarginControl({
  side,
  margin,
  topGap,
  onChange
}: SideMarginControlProps): React.JSX.Element {
  const dragStart = useRef<{ x: number; margin: number } | null>(null)

  return (
    <div
      className={`side-margin-control side-margin-control--${side}`}
      style={{ [side]: margin - 8, top: topGap }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragStart.current = { x: event.clientX, margin }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!dragStart.current) return
        const delta = event.clientX - dragStart.current.x
        onChange(dragStart.current.margin + (side === 'left' ? delta : -delta))
      }}
      onPointerUp={() => {
        dragStart.current = null
      }}
      onPointerCancel={() => {
        dragStart.current = null
      }}
    >
      <span />
    </div>
  )
}

type UnsavedChangesDialogProps = {
  isSaving: boolean
  onContinue: () => void
  onDiscard: () => void
  onSave: () => void
}

function UnsavedChangesDialog({
  isSaving,
  onContinue,
  onDiscard,
  onSave
}: UnsavedChangesDialogProps): React.JSX.Element {
  return (
    <div className="unsaved-dialog-backdrop" role="presentation" onMouseDown={onContinue}>
      <section
        className="unsaved-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="unsaved-dialog-title">Salvar alterações?</h2>
          <ModalCloseButton onClick={onContinue} disabled={isSaving} />
        </header>
        <p>Existem alterações nesta página que ainda não foram salvas.</p>
        <footer>
          <button type="button" onClick={onDiscard} disabled={isSaving}>
            Descartar alterações
          </button>
          <button
            className="unsaved-dialog-save"
            type="button"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Salvando…' : 'Salvar e sair'}
          </button>
        </footer>
      </section>
    </div>
  )
}
