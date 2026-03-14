import { describe, it, expect } from 'vitest'
import { INBOX_DOC_ID } from '@/lib/inbox'

describe('inbox', () => {
  it('exports the inbox doc ID constant', () => {
    expect(INBOX_DOC_ID).toBe('__inbox__')
  })
})
