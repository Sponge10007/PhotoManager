// User types
export interface User {
  id: string
  username: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

// Photo types
export interface GPSInfo {
  latitude: number
  longitude: number
}

export interface ExifInfo {
  make?: string
  model?: string
  lens?: string
  iso?: number
  aperture?: number
  shutterSpeed?: string
  focalLength?: number
  gps?: GPSInfo
  takenAt?: string
}

export interface Tag {
  name: string
  source: 'USER' | 'AI'
  score?: number
}

export interface Photo {
  id: string
  userId: string
  title: string
  description: string
  fileName: string
  path: string
  thumbPath: string
  hash: string
  size: number
  mimeType: string
  exif?: ExifInfo
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

// API request/response types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface PhotoListParams {
  page?: number
  limit?: number
  tag?: string
  startDate?: string
  endDate?: string
}

export interface PhotoListResponse {
  data: Photo[]
  meta: {
    total: number
    page: number
    limit: number
  }
}

export interface UpdatePhotoRequest {
  title?: string
  description?: string
  tags?: Tag[]
}
