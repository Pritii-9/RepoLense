import { api } from '@/services/api'
import type { AuthResponse, LoginPayload, RegisterPayload } from '@/types/api'

export async function login(payload: LoginPayload) {
  const response = await api.post<AuthResponse>('/auth/login', payload)
  return response.data
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<AuthResponse>('/auth/register', payload)
  return response.data
}
