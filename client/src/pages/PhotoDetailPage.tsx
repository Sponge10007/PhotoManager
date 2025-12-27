import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { photosApi } from '@/api/photos'

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: photo, isLoading } = useQuery({
    queryKey: ['photo', id],
    queryFn: () => photosApi.getPhotoById(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!photo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Photo not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:underline"
          >
            ← Back to Gallery
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Photo Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img
                src={photo.path}
                alt={photo.title}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Photo Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">{photo.title || 'Untitled'}</h2>
              <p className="text-gray-600 mb-4">{photo.description}</p>

              {/* Tags */}
              {photo.tags.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {photo.tags.map((tag, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 rounded-full text-sm ${
                          tag.source === 'AI'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tag.name} {tag.source === 'AI' && '🤖'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* EXIF Data */}
              {photo.exif && (
                <div>
                  <h3 className="font-semibold mb-2">EXIF Data</h3>
                  <dl className="text-sm space-y-1">
                    {photo.exif.make && (
                      <>
                        <dt className="text-gray-600">Camera</dt>
                        <dd>{photo.exif.make} {photo.exif.model}</dd>
                      </>
                    )}
                    {photo.exif.lens && (
                      <>
                        <dt className="text-gray-600">Lens</dt>
                        <dd>{photo.exif.lens}</dd>
                      </>
                    )}
                    {photo.exif.iso && (
                      <>
                        <dt className="text-gray-600">ISO</dt>
                        <dd>{photo.exif.iso}</dd>
                      </>
                    )}
                    {photo.exif.aperture && (
                      <>
                        <dt className="text-gray-600">Aperture</dt>
                        <dd>f/{photo.exif.aperture}</dd>
                      </>
                    )}
                    {photo.exif.shutterSpeed && (
                      <>
                        <dt className="text-gray-600">Shutter Speed</dt>
                        <dd>{photo.exif.shutterSpeed}</dd>
                      </>
                    )}
                    {photo.exif.focalLength && (
                      <>
                        <dt className="text-gray-600">Focal Length</dt>
                        <dd>{photo.exif.focalLength}mm</dd>
                      </>
                    )}
                    {photo.exif.takenAt && (
                      <>
                        <dt className="text-gray-600">Taken At</dt>
                        <dd>{new Date(photo.exif.takenAt).toLocaleString()}</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6 space-y-2">
              <button className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                Edit
              </button>
              <button className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
