import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { photosApi } from '@/api/photos'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: photosData, isLoading } = useQuery({
    queryKey: ['photos', page, limit],
    queryFn: () => photosApi.getPhotos({ page, limit }),
  })

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const handleUpload = () => {
    // TODO: Implement upload modal
    alert('Upload functionality will be implemented')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">PhotoMS</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Upload Photo
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">My Photos</h2>
          {/* TODO: Add filters and search */}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading photos...</p>
          </div>
        ) : photosData?.data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No photos yet. Upload your first photo!</p>
          </div>
        ) : (
          <>
            {/* Photo Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photosData?.data.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/photo/${photo.id}`)}
                >
                  <div className="aspect-square bg-gray-200">
                    <img
                      src={photo.thumbPath}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium truncate">{photo.title || 'Untitled'}</h3>
                    <p className="text-sm text-gray-600 truncate">{photo.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {photosData && photosData.meta.total > limit && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {Math.ceil(photosData.meta.total / limit)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= photosData.meta.total}
                  className="px-4 py-2 border rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
