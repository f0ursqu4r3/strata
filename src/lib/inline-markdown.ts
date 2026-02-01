import MarkdownIt from 'markdown-it'

const md = new MarkdownIt('zero', {
  linkify: true,
})
  // Enable only inline features
  .enable([
    'emphasis',
    'strikethrough',
    'backticks',
    'link',
    'image',
    'linkify',
    'escape',
    'newline',
  ])

// Open links in new tab
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet('target', '_blank')
  tokens[idx]!.attrSet('rel', 'noopener')
  tokens[idx]!.attrSet('class', 'strata-md-link')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// Style inline code
const defaultCodeInline =
  md.renderer.rules.code_inline ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!
  return `<code class="strata-md-code">${md.utils.escapeHtml(token.content)}</code>`
}

// Style images
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx]!
  const src = token.attrGet('src') ?? ''
  const alt = token.content ?? ''
  return `<img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}" class="strata-md-img" />`
}

/**
 * Render a single line of text as inline Markdown → HTML.
 * Only inline syntax is processed (bold, italic, code, links, images, strikethrough).
 */
export function renderInlineMarkdown(text: string): string {
  return md.renderInline(text)
}
