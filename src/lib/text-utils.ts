/**
 * Extract the first line (title) from text.
 * Treats the first newline as the title/body boundary.
 */
export function getTitle(text: string): string {
  if (!text) return ""
  const idx = text.indexOf("\n")
  return idx === -1 ? text : text.slice(0, idx)
}

/**
 * Extract everything after the first line (body) from text.
 * Returns empty string if no multiline content.
 */
export function getBody(text: string): string {
  if (!text) return ""
  const idx = text.indexOf("\n")
  return idx === -1 ? "" : text.slice(idx + 1)
}

/**
 * Combine title and body back into single text field.
 */
export function combineText(title: string, body: string): string {
  if (!body) return title
  return `${title}\n${body}`
}
