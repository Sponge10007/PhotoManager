import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { photosApi } from '@/api/photos'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, LogOut, Image as ImageIcon, 
  SlidersHorizontal, Tag, Clock, Menu, X, Upload
} from 'lucide-react' // 使用已安装的图标库

export default function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)

  const [page, setPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const limit = 20

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQ(searchInput.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const clearFilters = () => {
    setTag('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const resetAll = () => {
    setSearchInput('')
    setQ('')
    clearFilters()
    setFiltersOpen(false)
  }

  // 获取图片列表
  const { data: photosData, isLoading } = useQuery({
    queryKey: ['photos', page, limit, q, tag, startDate, endDate],
    queryFn: () => photosApi.getPhotos({ page, limit, q, tag, startDate, endDate }),
  })

  // 处理上传 Mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => photosApi.uploadPhoto(file),
    onSuccess: () => {
      // 上传成功后刷新列表并关闭模态框
      queryClient.invalidateQueries({ queryKey: ['photos'] })
      setIsUploadOpen(false)
      alert('图片上传成功！')
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '上传失败')
    }
  })

  
  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const setRecentUploads = () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    setStartDate(d.toISOString().slice(0, 10))
    setEndDate('')
    setFiltersOpen(true)
    setPage(1)
  }
  
  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  const total = photosData?.meta?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* 侧边栏 - 增强专业感 */}
      <aside className={`bg-card border-r w-64 flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'ml-0' : '-ml-64'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <ImageIcon size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">PhotoMS</h1>
          </div>

          <nav className="flex-1 space-y-1">
            <button
              onClick={resetAll}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary text-secondary-foreground font-medium"
            >
              <ImageIcon size={18} /> 全部图片
            </button>
            <button
              onClick={setRecentUploads}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground"
            >
              <Clock size={18} /> 最近上传
            </button>
            <button
              onClick={() => setFiltersOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground"
            >
              <Tag size={18} /> 标签管理
            </button>
          </nav>

          <div className="pt-4 border-t mt-auto">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs">
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                  <LogOut size={12} /> 退出登录
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 修改：顶部 Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索图片（标题/描述/标签）..."
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="p-2 hover:bg-secondary rounded-lg text-muted-foreground"
                aria-label="Filters"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="ml-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> 上传图片
          </button>
        </header>

        {filtersOpen && (
          <div className="border-b bg-card/30 backdrop-blur-md px-6 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">标签</label>
                <input
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value)
                    setPage(1)
                  }}
                  placeholder="精确标签（可选）"
                  className="w-48 bg-secondary/40 rounded-xl px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="bg-secondary/40 rounded-xl px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="bg-secondary/40 rounded-xl px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={clearFilters}
                className="ml-auto px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold hover:opacity-90"
              >
                清除筛选
              </button>
            </div>
          </div>
        )}

        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
          ) : (photosData?.data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
              <ImageIcon size={48} strokeWidth={1} className="mb-4" />
              <p>暂无图片</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {photosData?.data.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                    onClick={() => navigate(`/photo/${photo.id}`)}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={photo.thumbPath}
                        alt={photo.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                      <p className="text-white text-xs font-medium truncate">{photo.title || '未命名'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  disabled={!canPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold disabled:opacity-50"
                >
                  上一页
                </button>
                <div className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </div>
                <button
                  disabled={!canNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 图片上传模态框 */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-6 border-b flex justify-between items-center bg-secondary/30">
              <h3 className="text-lg font-bold">上传摄影作品</h3>
              <button onClick={() => setIsUploadOpen(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange} 
              />
              
              <div 
                onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[24px] p-12 transition-all cursor-pointer group flex flex-col items-center
                  ${uploadMutation.isPending ? 'border-primary/50 bg-primary/5 cursor-not-allowed' : 'border-primary/20 hover:border-primary hover:bg-primary/5'}`}
              >
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                    <p className="text-sm font-medium animate-pulse">正在上传并分析...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Upload className="text-primary" size={32} />
                    </div>
                    <p className="text-sm font-bold">点击选择图片</p>
                    <p className="text-xs text-muted-foreground mt-2">支持 JPG, PNG, WebP 格式</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
