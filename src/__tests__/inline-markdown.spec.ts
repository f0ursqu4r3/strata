import { describe, it, expect } from 'vitest'
import { renderInlineMarkdown } from '@/lib/inline-markdown'

describe('renderInlineMarkdown', () => {
  it('renders bold text', () => {
    const html = renderInlineMarkdown('Hello **world**')
    expect(html).toContain('<strong>world</strong>')
  })

  it('renders italic text', () => {
    const html = renderInlineMarkdown('Hello *world*')
    expect(html).toContain('<em>world</em>')
  })

  it('renders inline code', () => {
    const html = renderInlineMarkdown('Use `console.log`')
    expect(html).toContain('strata-md-code')
    expect(html).toContain('console.log')
  })

  it('renders strikethrough', () => {
    const html = renderInlineMarkdown('~~removed~~')
    expect(html).toContain('<s>removed</s>')
  })

  it('renders links with target blank and rel noopener', () => {
    const html = renderInlineMarkdown('[Click](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('strata-md-link')
  })

  it('passes plain text through unchanged', () => {
    const html = renderInlineMarkdown('Hello world')
    expect(html).toBe('Hello world')
  })

  it('escapes HTML entities in code blocks', () => {
    const html = renderInlineMarkdown('`<script>alert("xss")</script>`')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders images with strata-md-img class', () => {
    const html = renderInlineMarkdown('![alt text](https://example.com/img.png)')
    expect(html).toContain('strata-md-img')
    expect(html).toContain('alt="alt text"')
    expect(html).toContain('src="https://example.com/img.png"')
  })

  it('auto-links URLs', () => {
    const html = renderInlineMarkdown('Visit https://example.com today')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })
})
