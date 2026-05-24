// HTML sanitization for Supabase Edge Functions.
// deno_dom + DOMPurify fails at boot on the edge runtime (no document.window).
// sanitize-html (htmlparser2) is pure JS and works without a browser DOM.

import sanitize from 'https://esm.sh/sanitize-html@2.13.1'

export type SanitizeHtmlOptions = {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOWED_URI_REGEXP?: RegExp
  ALLOW_DATA_ATTR?: boolean
}

const DEFAULT_ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
]

function buildAllowedAttributes(
  tags: string[],
  attrs: string[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const tag of tags) {
    map[tag] = [...attrs]
  }
  return map
}

function schemeAllowed(href: string, uriPattern?: RegExp): boolean {
  if (!href) return true
  const trimmed = href.trim()
  if (trimmed.startsWith('#')) return true
  if (uriPattern && !uriPattern.test(trimmed)) return false
  try {
    const protocol = new URL(trimmed, 'https://example.com').protocol.replace(':', '')
    return protocol === 'http' || protocol === 'https' || protocol === 'mailto'
  } catch {
    return false
  }
}

export function sanitizeHtml(html: string, options?: SanitizeHtmlOptions): string {
  if (!html) return ''

  const allowedTags = options?.ALLOWED_TAGS ?? DEFAULT_ALLOWED_TAGS
  const allowedAttr = options?.ALLOWED_ATTR ?? [
    'href', 'title', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height',
  ]
  const uriPattern = options?.ALLOWED_URI_REGEXP

  return sanitize(html, {
    allowedTags,
    allowedAttributes: buildAllowedAttributes(allowedTags, allowedAttr),
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ?? ''
        if (!schemeAllowed(href, uriPattern)) {
          const { href: _drop, ...rest } = attribs
          return { tagName: 'a', attribs: rest }
        }
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: attribs.rel ?? 'noopener noreferrer',
            target: attribs.target ?? '_blank',
          },
        }
      },
    },
  })
}
