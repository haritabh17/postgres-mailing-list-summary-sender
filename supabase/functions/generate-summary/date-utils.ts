export function getWeekStart(date: Date): Date {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

export function getLastFriday(date: Date): Date {
  const lastFriday = new Date(date)
  const currentDay = lastFriday.getDay() // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

  console.log(`📅 DEBUG: getLastFriday called with date: ${date.toISOString()}, currentDay: ${currentDay}`)

  // Calculate days to subtract to get to LAST Friday (not today even if today is Friday)
  let daysToSubtract = 0
  if (currentDay === 5) {
    // Today is Friday, go back 7 days to last Friday
    daysToSubtract = 7
  } else if (currentDay === 6) {
    // Saturday -> 1 day back to yesterday's Friday
    daysToSubtract = 1
  } else {
    // Sunday (0) through Thursday (4) -> go back to previous Friday
    daysToSubtract = currentDay + 2 // Sunday: 2, Monday: 3, Tuesday: 4, Wednesday: 5, Thursday: 6
  }

  console.log(`📅 DEBUG: daysToSubtract: ${daysToSubtract}`)
  lastFriday.setDate(lastFriday.getDate() - daysToSubtract)
  console.log(`📅 DEBUG: lastFriday result: ${lastFriday.toISOString()}`)

  return lastFriday
}
