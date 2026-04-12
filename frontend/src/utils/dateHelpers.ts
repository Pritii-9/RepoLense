const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not available'
  }

  return dateTimeFormatter.format(new Date(value))
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return 'Unknown'
  }

  return shortDateFormatter.format(new Date(value))
}

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return 'Just now'
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  return rtf.format(diffDays, 'day')
}
