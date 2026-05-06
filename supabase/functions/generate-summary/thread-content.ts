// Helper function to extract content from thread object (handles both old and new schema)
export function getThreadContent(thread: any): string | null {
  // New schema: content is in mail_thread_contents relation
  if (thread.mail_thread_contents && thread.mail_thread_contents.content) {
    return thread.mail_thread_contents.content
  }
  // Old schema: content is directly on thread (for backward compatibility during migration)
  if (thread.content) {
    return thread.content
  }
  return null
}
