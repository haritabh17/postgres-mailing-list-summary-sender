// DOMPurify on Supabase Edge: use deno_dom + dompurify (not isomorphic-dompurify,
// which pulls canvas.node and fails the deploy bundle).

import DOMPurify from 'https://esm.sh/dompurify@3.2.6?target=denonext'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.49/deno-dom-wasm.ts'

const document = new DOMParser().parseFromString(
  '<!DOCTYPE html><html><body></body></html>',
  'text/html',
)
const window = document?.window
if (!window) {
  throw new Error('sanitize-html: failed to initialize DOM')
}

const purify = DOMPurify(window)

export type SanitizeHtmlOptions = Parameters<typeof purify.sanitize>[1]

export function sanitizeHtml(html: string, options?: SanitizeHtmlOptions): string {
  return purify.sanitize(html, options) as string
}
