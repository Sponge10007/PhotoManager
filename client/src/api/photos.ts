import api from './axios'
import type { Photo, PhotoListParams, PhotoListResponse, UpdatePhotoRequest } from '@/types'

export const photosApi = {
  uploadPhoto: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<any, { id: string; url: string }>('/photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  getPhotos: (params: PhotoListParams) =>
    api.get<any, PhotoListResponse>('/photos', { params }),

  getPhotoById: (id: string) =>
    api.get<any, Photo>(`/photos/${id}`),

  updatePhoto: (id: string, data: UpdatePhotoRequest) =>
    api.put<any, Photo>(`/photos/${id}`, data),

  deletePhoto: (id: string) =>
    api.delete<any, { message: string }>(`/photos/${id}`),
}
