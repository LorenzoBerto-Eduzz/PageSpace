import { useEffect, useMemo, useState } from 'react'
import type { PageEditorData } from '../../../shared/page-contracts'
import type {
  CollectionEditableField,
  CollectionItemField,
  JsonValue,
  PageSpaceEditableContent,
  PageSpaceEditableField
} from '../../../shared/pagespace-package-contracts'
import { ArrowLeftIcon, EyeIcon, RefreshIcon, SaveIcon, SettingsIcon, TrashIcon } from './icons'

type PackagePageEditorProps = {
  pageId: string
  onBack: () => void
  onSaved: (data: PageEditorData) => void
  onOpenSettings: (pageId: string, hasUnsavedChanges: boolean) => void
}

function cloneContent(content: PageSpaceEditableContent): PageSpaceEditableContent {
  return JSON.parse(JSON.stringify(content)) as PageSpaceEditableContent
}

function defaultFieldValue(field: CollectionItemField): JsonValue {
  switch (field.type) {
    case 'boolean':
      return false
    case 'color':
      return '#ffffff'
    case 'select':
      return field.options[0]?.value ?? ''
    default:
      return ''
  }
}

function createCollectionItem(field: CollectionEditableField): Record<string, JsonValue> {
  return Object.fromEntries([
    ['_id', crypto.randomUUID()],
    ...field.fields.map((itemField) => [itemField.key, defaultFieldValue(itemField)])
  ])
}

export function PackagePageEditor({
  pageId,
  onBack,
  onSaved,
  onOpenSettings
}: PackagePageEditorProps): React.JSX.Element {
  const [data, setData] = useState<PageEditorData | null>(null)
  const [content, setContent] = useState<PageSpaceEditableContent | null>(null)
  const [savedContent, setSavedContent] = useState<PageSpaceEditableContent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingSource, setIsRefreshingSource] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(savedContent),
    [content, savedContent]
  )

  useEffect(() => {
    let current = true
    window.pageSpace
      .getPage(pageId)
      .then((loaded) => {
        if (!current) return
        setData(loaded)
        const loadedContent = loaded.kind === 'package' ? loaded.content : null
        setContent(loadedContent ? cloneContent(loadedContent) : null)
        setSavedContent(loadedContent ? cloneContent(loadedContent) : null)
        void window.pageSpace.getPagePreviewUrl(pageId).then((url) => {
          if (current) setPreviewUrl(url)
        })
      })
      .catch((loadError) => {
        if (current) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível abrir a página.'
          )
        }
      })
    return () => {
      current = false
    }
  }, [pageId])

  function updateValue(key: string, value: JsonValue): void {
    setError(null)
    setContent((current) =>
      current
        ? {
            ...current,
            values: {
              ...current.values,
              [key]: value
            }
          }
        : current
    )
  }

  async function save(): Promise<void> {
    if (!content || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const saved = await window.pageSpace.savePackageContent({ pageId, content })
      if (!data || data.kind !== 'package' || saved.kind !== 'package' || !saved.content) {
        throw new Error('O PageSpace não retornou o conteúdo salvo.')
      }
      try {
        saved.page.previewDataUrl = await window.pageSpace.capturePagePreview(pageId)
      } catch {
        // Saving remains successful when only the replaceable dashboard image fails.
      }
      let completedSave: Extract<PageEditorData, { kind: 'package' }> = saved
      if (saved.page.deployment.kind === 'published') {
        try {
          const published = await window.pageSpace.publishPage({ pageId })
          completedSave = { ...saved, page: published.page }
        } catch (publishError) {
          const current = await window.pageSpace.getPage(pageId)
          if (current.kind === 'package') completedSave = current
          setError(
            publishError instanceof Error
              ? publishError.message
              : 'A página foi salva localmente, mas não foi publicada.'
          )
        }
      }
      setData(completedSave)
      setContent(cloneContent(saved.content))
      setSavedContent(cloneContent(saved.content))
      setPreviewUrl(`${await window.pageSpace.getPagePreviewUrl(pageId)}?version=${Date.now()}`)
      onSaved(completedSave)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  async function refreshSource(): Promise<void> {
    if (!data || isRefreshingSource) return
    if (isDirty && !window.confirm('Descartar as alterações locais e atualizar da origem?')) return
    setIsRefreshingSource(true)
    setError(null)
    try {
      await window.pageSpace.refreshPageFromSource(pageId)
      if (data.page.deployment.kind === 'published') {
        await window.pageSpace.publishPage({ pageId })
      }
      const refreshed = await window.pageSpace.getPage(pageId)
      setData(refreshed)
      const refreshedContent = refreshed.kind === 'package' ? refreshed.content : null
      setContent(refreshedContent ? cloneContent(refreshedContent) : null)
      setSavedContent(refreshedContent ? cloneContent(refreshedContent) : null)
      setPreviewUrl(`${await window.pageSpace.getPagePreviewUrl(pageId)}?version=${Date.now()}`)
      onSaved(refreshed)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível atualizar a página da origem.'
      )
    } finally {
      setIsRefreshingSource(false)
    }
  }

  function leave(): void {
    if (isDirty && !window.confirm('Descartar as alterações que ainda não foram salvas?')) return
    onBack()
  }

  if (!data) {
    return (
      <main className="package-editor package-editor--loading">
        <button type="button" className="package-editor-back" onClick={onBack}>
          <ArrowLeftIcon size={20} />
          Voltar
        </button>
        <p>{error ?? 'Abrindo página…'}</p>
      </main>
    )
  }

  const editableData =
    data.kind === 'package' && data.schema && content ? { schema: data.schema, content } : null

  return (
    <main className="package-editor">
      <header className="package-editor-header">
        <button type="button" className="package-editor-back" onClick={leave}>
          <ArrowLeftIcon size={20} />
          Voltar
        </button>
        <div>
          <h1>{data.page.name}</h1>
          {data.kind === 'package' ? (
            <p>
              {data.manifest.packageId} · versão {data.manifest.packageVersion}
            </p>
          ) : null}
        </div>
        <div className="package-editor-header-actions">
          {data.page.sourceSync.state === 'update-available' ? (
            <button type="button" onClick={refreshSource} disabled={isRefreshingSource || isSaving}>
              <RefreshIcon size={18} />
              {isRefreshingSource
                ? 'Atualizando…'
                : data.page.deployment.kind === 'published'
                  ? 'Atualizar e publicar'
                  : 'Atualizar da origem'}
            </button>
          ) : null}
          {data.page.sourceSync.state === 'unavailable' ? (
            <span className="package-source-unavailable">Origem indisponível</span>
          ) : null}
          <button type="button" onClick={() => window.pageSpace.openLocalPage(pageId)}>
            <EyeIcon size={18} />
            Ver localmente
          </button>
          <button type="button" onClick={() => onOpenSettings(pageId, isDirty)} disabled={isSaving}>
            <SettingsIcon size={18} />
            Publicação
          </button>
          {content ? (
            <button
              type="button"
              className="package-save"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              <SaveIcon size={18} />
              {isSaving
                ? 'Salvando…'
                : data.page.deployment.kind === 'published'
                  ? 'Salvar e publicar'
                  : 'Salvar e preparar'}
            </button>
          ) : null}
        </div>
      </header>

      <div
        className={
          editableData
            ? 'package-editor-layout package-editor-layout--with-fields'
            : 'package-editor-layout'
        }
      >
        <section className="package-preview-panel" aria-label="Prévia da página">
          {previewUrl ? (
            <iframe
              className="package-live-preview"
              src={previewUrl}
              title={`Visualização de ${data.page.name}`}
              sandbox="allow-scripts"
            />
          ) : (
            <div className="package-preview-empty">
              <p>Carregando a página…</p>
              <button type="button" onClick={() => window.pageSpace.openLocalPage(pageId)}>
                Abrir página local
              </button>
            </div>
          )}
        </section>

        {editableData ? (
          <aside className="package-fields-panel">
            <div className="package-fields-heading">
              <h2>Conteúdo editável</h2>
              <p>Somente os campos definidos pelo autor do pacote aparecem aqui.</p>
            </div>
            <div className="package-fields">
              {editableData.schema.fields.map((field) => (
                <EditableFieldControl
                  key={field.key}
                  pageId={pageId}
                  field={field}
                  value={editableData.content.values[field.key]}
                  onChange={(value) => updateValue(field.key, value)}
                />
              ))}
            </div>
            {error ? <p className="package-editor-error">{error}</p> : null}
          </aside>
        ) : null}
      </div>
    </main>
  )
}

type EditableFieldControlProps = {
  pageId: string
  field: PageSpaceEditableField
  value: JsonValue | undefined
  onChange: (value: JsonValue) => void
}

function EditableFieldControl({
  pageId,
  field,
  value,
  onChange
}: EditableFieldControlProps): React.JSX.Element {
  if (field.type === 'collection') {
    const items = Array.isArray(value)
      ? (value.filter(
          (item): item is Record<string, JsonValue> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        ) as Record<string, JsonValue>[])
      : []
    const maximum = field.maxItems ?? 200

    function updateItem(index: number, key: string, nextValue: JsonValue): void {
      onChange(
        items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: nextValue } : item))
      )
    }

    function move(index: number, offset: number): void {
      const target = index + offset
      if (target < 0 || target >= items.length) return
      const next = [...items]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      onChange(next)
    }

    return (
      <fieldset className="package-collection">
        <legend>{field.label}</legend>
        {field.helpText ? <p>{field.helpText}</p> : null}
        <div className="package-collection-items">
          {items.map((item, index) => (
            <section className="package-collection-item" key={String(item._id ?? index)}>
              <header>
                <strong>
                  {field.itemLabel ?? 'Item'} {index + 1}
                </strong>
                <div>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${field.itemLabel ?? 'item'} ${index + 1}`}
                    onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </header>
              {field.fields.map((itemField) => (
                <ScalarFieldControl
                  key={itemField.key}
                  pageId={pageId}
                  field={itemField}
                  value={item[itemField.key]}
                  onChange={(nextValue) => updateItem(index, itemField.key, nextValue)}
                />
              ))}
            </section>
          ))}
        </div>
        <button
          type="button"
          className="package-add-collection-item"
          onClick={() => onChange([...items, createCollectionItem(field)])}
          disabled={items.length >= maximum}
        >
          Adicionar {field.itemLabel?.toLocaleLowerCase('pt-BR') ?? 'item'}
        </button>
      </fieldset>
    )
  }
  return <ScalarFieldControl pageId={pageId} field={field} value={value} onChange={onChange} />
}

type ScalarFieldControlProps = {
  pageId: string
  field: CollectionItemField
  value: JsonValue | undefined
  onChange: (value: JsonValue) => void
}

function ScalarFieldControl({
  pageId,
  field,
  value,
  onChange
}: ScalarFieldControlProps): React.JSX.Element {
  const stringValue = typeof value === 'string' ? value : ''

  if (field.type === 'boolean') {
    return (
      <label className="package-boolean-field">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <strong>{field.label}</strong>
          {field.helpText ? <small>{field.helpText}</small> : null}
        </span>
      </label>
    )
  }

  if (field.type === 'image') {
    return (
      <div className="package-field">
        <span className="package-field-label">{field.label}</span>
        {stringValue ? <small className="package-image-path">{stringValue}</small> : null}
        <button
          type="button"
          className="package-image-button"
          onClick={async () => {
            const selected = await window.pageSpace.choosePageImage(pageId)
            if (selected) onChange(selected)
          }}
        >
          {stringValue ? 'Trocar imagem' : 'Escolher imagem'}
        </button>
        {stringValue && !field.required ? (
          <button type="button" className="package-clear-image" onClick={() => onChange('')}>
            Remover imagem
          </button>
        ) : null}
        {field.helpText ? <small>{field.helpText}</small> : null}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="package-field">
        <span className="package-field-label">{field.label}</span>
        <select value={stringValue} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.helpText ? <small>{field.helpText}</small> : null}
      </label>
    )
  }

  if (field.type === 'textarea') {
    return (
      <label className="package-field">
        <span className="package-field-label">{field.label}</span>
        <textarea
          value={stringValue}
          required={field.required}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.helpText ? <small>{field.helpText}</small> : null}
      </label>
    )
  }

  return (
    <label className="package-field">
      <span className="package-field-label">{field.label}</span>
      <input
        type={field.type === 'color' ? 'color' : field.type === 'url' ? 'url' : 'text'}
        value={stringValue}
        required={field.required}
        maxLength={field.type === 'text' ? field.maxLength : undefined}
        placeholder={'placeholder' in field ? field.placeholder : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.helpText ? <small>{field.helpText}</small> : null}
    </label>
  )
}
