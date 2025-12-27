import api from './axios'
import type { LoginRequest, RegisterRequest, AuthResponse } from '@/types'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<any, AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<any, AuthResponse>('/auth/login', data),

  logout: () => {
    localStorage.removeItem('token')
  },
}
