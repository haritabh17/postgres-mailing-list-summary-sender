export function formatDateWithOrdinal(date: Date): string {
  const day = date.getDate()
  const ordinal = (d: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = d % 100
    return d + (s[(v - 20) % 10] || s[v] || s[0])
  }
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${ordinal(day)} ${monthYear}`
}
