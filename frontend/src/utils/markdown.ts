import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

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

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const tagsContainerRegex = /<div class="tags-container">[\s\S]*?<\/div>/gi
  const tagsContainers: string[] = []
  let tagsIndex = 0
  let protectedMarkdown = markdown.replace(tagsContainerRegex, (match) => {
    tagsContainers.push(match)
    return `<!--TAGS_CONTAINER_PLACEHOLDER_${tagsIndex++}-->`
  })

  protectedMarkdown = protectedMarkdown.replace(/`([^`]+)`/g, (_match, code) => {
    return '`' + code.replace(/\\/g, '\\\\') + '`';
  });

  let html = marked(protectedMarkdown) as string;

  tagsContainers.forEach((tags, index) => {
    const placeholder = `<!--TAGS_CONTAINER_PLACEHOLDER_${index}-->`
    html = html.split(placeholder).join(tags)
  })

  html = sanitizeHtml(html);
  html = html.replace(/<a href="([^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  return html;
}
