export function isValidGitHubUrl(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  
  // Support owner/repo shorthand
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return true
  }

  try {
    const targetUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(targetUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)
    return (
      url.hostname.toLowerCase() === 'github.com' &&
      pathParts.length >= 2 &&
      Boolean(pathParts[0]) &&
      Boolean(pathParts[1])
    )
  } catch {
    return false
  }
}

export function isValidEmail(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value.trim())
}

export function isValidBranchName(value: string): boolean {
  if (!value) return true // Branch is optional
  const branchRegex = /^[a-zA-Z0-9_\-\.\/]+$/
  return branchRegex.test(value.trim())
}
