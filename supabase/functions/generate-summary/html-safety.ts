export function escapeHtmlTagsInText(text: string): string {
  // Escape HTML/XML-like tags that aren't part of markdown syntax
  // This prevents tags like <sect1>, <title>, <productname> from being interpreted as HTML

  // First, protect tags container to prevent escaping
  const tagsContainerRegex = /<div class="tags-container">[\s\S]*?<\/div>/gi
  const tagsContainers: string[] = []
  let tagsContainerIndex = 0
  let protectedText = text.replace(tagsContainerRegex, (match) => {
    tagsContainers.push(match)
    return `__TAGS_CONTAINER_${tagsContainerIndex++}__`
  })

  // Protect markdown code blocks (backticks)
  const codeBlockRegex = /`([^`]+)`/g
  const codeBlocks: string[] = []
  let codeBlockIndex = 0
  protectedText = protectedText.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match)
    return `__CODE_BLOCK_${codeBlockIndex++}__`
  })

  // Protect markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const links: string[] = []
  let linkIndex = 0
  protectedText = protectedText.replace(linkRegex, (match) => {
    links.push(match)
    return `__LINK_${linkIndex++}__`
  })

  // Protect HTML entities that are already escaped
  const entityRegex = /&[a-z0-9#]+;/gi
  const entities: string[] = []
  let entityIndex = 0
  protectedText = protectedText.replace(entityRegex, (match) => {
    entities.push(match)
    return `__ENTITY_${entityIndex++}__`
  })

  // Now escape standalone HTML/XML-like tags (angle brackets with alphanumeric content)
  // Pattern: < followed by word characters, optional attributes, and >
  protectedText = protectedText.replace(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g, (match, tagName, attrs) => {
    // Don't escape common markdown HTML tags that are safe
    const safeTags = ['br', 'hr', 'p', 'div', 'span', 'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
    if (safeTags.includes(tagName.toLowerCase())) {
      return match // Keep safe tags as-is
    }
    // Escape other tags
    return `&lt;${tagName}${attrs || ''}&gt;`
  })

  // Escape closing tags
  protectedText = protectedText.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g, (match, tagName) => {
    const safeTags = ['br', 'hr', 'p', 'div', 'span', 'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
    if (safeTags.includes(tagName.toLowerCase())) {
      return match
    }
    return `&lt;/${tagName}&gt;`
  })

  // Restore protected tags containers
  tagsContainers.forEach((container, index) => {
    protectedText = protectedText.replace(`__TAGS_CONTAINER_${index}__`, container)
  })

  // Restore protected code blocks
  codeBlocks.forEach((block, index) => {
    protectedText = protectedText.replace(`__CODE_BLOCK_${index}__`, block)
  })

  // Restore protected links
  links.forEach((link, index) => {
    protectedText = protectedText.replace(`__LINK_${index}__`, link)
  })

  // Restore protected entities
  entities.forEach((entity, index) => {
    protectedText = protectedText.replace(`__ENTITY_${index}__`, entity)
  })

  return protectedText
}
