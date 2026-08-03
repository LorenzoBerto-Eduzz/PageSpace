import { describe, expect, it } from 'vitest'
import {
  PAGESPACE_PACKAGE_CONTRACT_VERSION,
  PAGESPACE_REFERENCE_EDITABLE_CONTENT,
  PAGESPACE_REFERENCE_EDITABLE_SCHEMA,
  createPageSpaceAiInstructions
} from './pagespace-ai-instructions'
import { parseEditableSchema, validateEditableContent } from './pagespace-package-service'
import {
  PAGESPACE_ALLOWED_SITE_EXTENSIONS,
  PAGESPACE_PACKAGE_LIMITS
} from '../shared/pagespace-package-limits'

describe('PageSpace AI instructions', () => {
  it('keeps the complete reference schema and content accepted by the real validator', () => {
    const schema = parseEditableSchema(PAGESPACE_REFERENCE_EDITABLE_SCHEMA)
    const content = validateEditableContent(PAGESPACE_REFERENCE_EDITABLE_CONTENT, schema)

    expect(content.values).toEqual(PAGESPACE_REFERENCE_EDITABLE_CONTENT.values)
  })

  it('generates a versioned, validator-aligned compatibility specification', () => {
    const instructions = createPageSpaceAiInstructions('9.8.7')

    expect(instructions).toContain('Target PageSpace version: 9.8.7')
    expect(instructions).toContain(`Required contract: ${PAGESPACE_PACKAGE_CONTRACT_VERSION}`)
    expect(instructions).toContain(`Maximum public files: ${PAGESPACE_PACKAGE_LIMITS.maxFiles}`)
    expect(instructions).toContain(
      `Maximum bytes per file: ${PAGESPACE_PACKAGE_LIMITS.maxFileBytes}`
    )
    expect(instructions).toContain(
      `Maximum total public bytes: ${PAGESPACE_PACKAGE_LIMITS.maxTotalBytes}`
    )
    expect(instructions).toContain(PAGESPACE_ALLOWED_SITE_EXTENSIONS.join(', '))
    expect(instructions).toContain(JSON.stringify(PAGESPACE_REFERENCE_EDITABLE_SCHEMA, null, 2))
    expect(instructions).toContain(JSON.stringify(PAGESPACE_REFERENCE_EDITABLE_CONTENT, null, 2))

    for (const fieldType of [
      'text',
      'textarea',
      'url',
      'color',
      'image',
      'boolean',
      'select',
      'collection'
    ]) {
      expect(instructions).toContain(fieldType)
    }

    for (const requiredProtocolTerm of [
      'pagespace-content.js',
      'pagespace:editor-state',
      'pagespace:editor-content-change',
      'pagespace:editor-image-request',
      'pagespace:editor-image-result',
      'pagespace:open-link',
      'FINAL AI/HUMAN SELF-CHECK'
    ]) {
      expect(instructions).toContain(requiredProtocolTerm)
    }
  })
})
