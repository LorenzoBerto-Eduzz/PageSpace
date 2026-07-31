export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type PageSpacePackageMode = 'static' | 'editable'

export type PageSpacePackageManifest = {
  schemaVersion: 1
  packageId: string
  packageVersion: string
  name: string
  description: string
  mode: PageSpacePackageMode
  entryPoint: 'index.html'
}

type EditableFieldBase = {
  key: string
  label: string
  helpText?: string
  required?: boolean
}

export type TextEditableField = EditableFieldBase & {
  type: 'text' | 'textarea'
  maxLength?: number
  placeholder?: string
}

export type UrlEditableField = EditableFieldBase & {
  type: 'url'
  placeholder?: string
}

export type ColorEditableField = EditableFieldBase & {
  type: 'color'
}

export type ImageEditableField = EditableFieldBase & {
  type: 'image'
  altLabel?: string
}

export type BooleanEditableField = EditableFieldBase & {
  type: 'boolean'
}

export type SelectEditableField = EditableFieldBase & {
  type: 'select'
  options: Array<{
    value: string
    label: string
  }>
}

export type CollectionItemField =
  | TextEditableField
  | UrlEditableField
  | ColorEditableField
  | ImageEditableField
  | BooleanEditableField
  | SelectEditableField

export type CollectionEditableField = EditableFieldBase & {
  type: 'collection'
  itemLabel?: string
  maxItems?: number
  fields: CollectionItemField[]
}

export type PageSpaceEditableField = CollectionItemField | CollectionEditableField

export type PageSpaceEditableSchema = {
  schemaVersion: 1
  fields: PageSpaceEditableField[]
}

export type PageSpaceEditableContent = {
  schemaVersion: 1
  values: Record<string, JsonValue>
}

export type PageSpacePackageSource = {
  kind: 'package'
  packageId: string
  packageVersion: string
  mode: PageSpacePackageMode
}

export type SimplePageSource = {
  kind: 'simple'
}

export type ImportedWebsiteSource = {
  kind: 'website'
  sourceKey: string
}

export type PageSource = SimplePageSource | PageSpacePackageSource | ImportedWebsiteSource
