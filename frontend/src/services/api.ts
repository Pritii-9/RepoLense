import axios from 'axios'

const apiBaseUrl =
  typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : undefined

const api = axios.create({
  ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
  withCredentials: true,
  timeout: 15_000,
})

let accessToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function registerUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    return error.response?.data?.detail ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.()
    }

    return Promise.reject(error instanceof Error ? error : new Error('Request failed.'))
  },
)

export { api }
