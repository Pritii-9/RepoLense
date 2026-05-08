import { api } from '@/services/api'
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  RegistrationResponse,
  VerifyPayload,
  ResendPayload,
  VerifyResponse,
} from '@/types/api'

export async function login(payload: LoginPayload) {
  const response = await api.post<AuthResponse>('/auth/login', payload)
  return response.data
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<RegistrationResponse>('/auth/register', payload)
  return response.data
}

/** Verify email using the 6-digit OTP code. */
export async function verifyEmail(payload: VerifyPayload): Promise<VerifyResponse> {
  const response = await api.post<VerifyResponse>('/auth/verify', payload)
  return response.data
}

/** Resend OTP code — only email is required. */
export async function resendVerification(payload: ResendPayload): Promise<VerifyResponse> {
  const response = await api.post<VerifyResponse>('/auth/resend-verification', payload)
  return response.data
}
