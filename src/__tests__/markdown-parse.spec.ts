import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '@/lib/markdown-parse'

describe('parseMarkdown deterministic IDs', () => {
  it('generates deterministic root ID', () => {
    const md = `---\ndoc-type: strata\n---\n\n- [ ] Item\n`
    const r1 = parseMarkdown(md)
    const r2 = parseMarkdown(md)
    expect(r1.rootId).toBe('n-root')
    expect(r2.rootId).toBe(r1.rootId)
  })

  it('generates deterministic child IDs from tree position', () => {
    const md = `---\ndoc-type: strata\n---\n\n- [ ] First\n- [ ] Second\n  - [ ] Nested\n`
    const r1 = parseMarkdown(md)
    const r2 = parseMarkdown(md)

    const ids1 = [...r1.nodes.keys()].sort()
    const ids2 = [...r2.nodes.keys()].sort()
    expect(ids1).toEqual(ids2)
  })

  it('uses position-based IDs like n-0, n-1, n-1-0', () => {
    const md = `---\ndoc-type: strata\n---\n\n- [ ] First\n- [ ] Second\n  - [ ] Child of second\n`
    const result = parseMarkdown(md)

    expect(result.nodes.has('n-root')).toBe(true)
    expect(result.nodes.has('n-0')).toBe(true)
    expect(result.nodes.has('n-1')).toBe(true)
    expect(result.nodes.has('n-1-0')).toBe(true)
  })

  it('produces different IDs for different tree positions', () => {
    const md = `---\ndoc-type: strata\n---\n\n- [ ] A\n- [ ] B\n- [ ] C\n`
    const result = parseMarkdown(md)

    const ids = [...result.nodes.keys()]
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
