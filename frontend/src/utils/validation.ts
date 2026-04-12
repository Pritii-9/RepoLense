export function isValidGitHubUrl(value: string) {
  try {
    const url = new URL(value)
    const pathParts = url.pathname.split('/').filter(Boolean)
    return (
      url.hostname.toLowerCase() === 'github.com' &&
      pathParts.length >= 2 &&
      !pathParts[0]?.endsWith('.git')
    )
  } catch {
    return false
  }
}
