import { isValidGitHubUrl } from '@/utils/validation'

describe('isValidGitHubUrl', () => {
  it('accepts a standard GitHub repository URL', () => {
    expect(isValidGitHubUrl('https://github.com/octocat/Hello-World')).toBe(true)
  })

  it('rejects non-GitHub URLs', () => {
    expect(isValidGitHubUrl('https://gitlab.com/octocat/Hello-World')).toBe(false)
  })

  it('rejects repository URLs without owner and repo segments', () => {
    expect(isValidGitHubUrl('https://github.com/octocat')).toBe(false)
  })
})
