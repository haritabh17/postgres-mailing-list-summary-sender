import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for consistent output
marked.setOptions({
  gfm: true,          // GitHub Flavored Markdown
  breaks: true,       // Convert line breaks to <br> tags
});

// Allowlist for sanitizing AI-generated markdown HTML before injecting it into
// the DOM. The summary text comes from an LLM that summarizes scraped mailing
// list content, so the HTML must never be trusted to be safe.
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'a', 'p', 'br', 'hr', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'class',
    'data-tag-source', 'style',
    'src', 'alt', 'width', 'height',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}

// Enhanced markdown to HTML converter using marked library
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Protect tags container before markdown processing
  const tagsContainerRegex = /<div class="tags-container">[\s\S]*?<\/div>/gi
  const tagsContainers: string[] = []
  let tagsIndex = 0
  let protectedMarkdown = markdown.replace(tagsContainerRegex, (match) => {
    tagsContainers.push(match)
    return `<!--TAGS_CONTAINER_PLACEHOLDER_${tagsIndex++}-->`
  })

  // Escape backslashes inside backtick-delimited code spans so marked doesn't treat them as escape sequences
  protectedMarkdown = protectedMarkdown.replace(/`([^`]+)`/g, (_match, code) => {
    return '`' + code.replace(/\\/g, '\\\\') + '`';
  });

  // Use marked library for reliable markdown conversion
  let html = marked(protectedMarkdown) as string;

  // Restore protected tags containers (server-built, safe to inline)
  tagsContainers.forEach((tags, index) => {
    const placeholder = `<!--TAGS_CONTAINER_PLACEHOLDER_${index}-->`
    html = html.split(placeholder).join(tags)
  })

  // Sanitize the combined HTML before it ever reaches the DOM.
  html = sanitizeHtml(html);

  // Add target="_blank" + rel for safer external link behavior.
  html = html.replace(/<a href="([^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  return html;
}

// Truncate HTML content while preserving tags
export function truncateHtml(html: string, maxLength: number): string {
  if (html.length <= maxLength) return html;

  // Remove HTML tags for length calculation
  const textContent = html.replace(/<[^>]*>/g, '');

  if (textContent.length <= maxLength) return html;

  // Find a good breaking point
  let truncated = html.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated + '...';
}
