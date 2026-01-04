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
  
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'tags'>('all'); // 踪激活标签
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

  // const resetAll = () => {
  //   setSearchInput('')
  //   setQ('')
  //   clearFilters()
  //   setFiltersOpen(false)
  // }

  const handleShowAll = () => {
    setActiveTab('all');
    setSearchInput('');
    setQ('');
    setTag('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setFiltersOpen(false); // 关闭筛选面板让界面更清爽
  };

  const handleShowRecent = () => {
    setActiveTab('recent');
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setStartDate(d.toISOString().slice(0, 10));
    setEndDate('');
    setFiltersOpen(true);
    setPage(1);
  };

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

  // const setRecentUploads = () => {
  //   const d = new Date()
  //   d.setDate(d.getDate() - 7)
  //   setStartDate(d.toISOString().slice(0, 10))
  //   setEndDate('')
  //   setFiltersOpen(true)
  //   setPage(1)
  // }
  
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

          <nav className="flex-1 space-y-2">
            {[
              { id: 'all', icon: <ImageIcon size={18} />, label: '全部图片', action: handleShowAll },
              { id: 'recent', icon: <Clock size={18} />, label: '最近上传', action: handleShowRecent },
              { id: 'tags', icon: <Tag size={18} />, label: '标签管理', action: () => { setActiveTab('tags'); setFiltersOpen(true); } },
            ].map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className={`group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 overflow-hidden ${
                  activeTab === item.id 
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]' 
                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                {/* 激活时的垂直指示条 */}
                <div className={`absolute left-0 w-1 bg-primary rounded-r-full transition-all duration-300 ${
                  activeTab === item.id ? 'h-6 opacity-100' : 'h-0 opacity-0'
                }`} />
                
                {/* 图标动画 */}
                <span className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:translate-x-1'}`}>
                  {item.icon}
                </span>
                
                <span className="font-medium tracking-wide text-sm">{item.label}</span>

                {/* 悬浮时的微光效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
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
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-secondary rounded-lg text-muted-foreground">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            {/* 搜索栏部分 - 适配白色背景 */}
            <div className="flex items-center gap-3 max-w-xl w-full">
              <div className="relative flex-1 group">
                {/* 搜索图标 */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors">
                  <Search size={18} />
                </div>
                
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索您的灵感..."
                  className="w-full pl-12 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm transition-all duration-300
                            text-zinc-900 placeholder:text-zinc-400
                            focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/5 focus:outline-none
                            shadow-sm hover:shadow-md"
                />
                
                {/* 快捷键提示 */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 border border-zinc-200 rounded-md bg-white text-[10px] text-zinc-400 font-mono hidden sm:block shadow-sm">
                  ⌘ K
                </div>
              </div>

              {/* 筛选切换按钮 */}
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`p-2.5 rounded-2xl border transition-all duration-300 ${
                  filtersOpen 
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' 
                    : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'
                }`}
              >
                <SlidersHorizontal size={20} />
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

        {/* 标签与日期筛选面板 - 适配白色背景 */}
        {filtersOpen && (
          <div className="mx-6 mt-4 p-5 bg-white border border-zinc-100 rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-wrap items-end gap-8">
              {/* 标签输入 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                  <Tag size={12} className="text-primary/70" /> 标签名称
                </label>
                <input
                  value={tag}
                  onChange={(e) => { setTag(e.target.value); setPage(1); }}
                  placeholder="例如: 风景"
                  className="w-44 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm text-zinc-900 focus:bg-white focus:border-primary/40 focus:outline-none transition-all"
                />
              </div>

              {/* 日期范围 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1">
                  <Clock size={12} className="text-primary/70" /> 拍摄日期
                </label>
                <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 shadow-inner">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    className="bg-transparent border-none py-2 text-sm focus:ring-0 text-zinc-700 appearance-none"
                  />
                  <span className="text-zinc-300 font-light">→</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    className="bg-transparent border-none py-2 text-sm focus:ring-0 text-zinc-700 appearance-none"
                  />
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  重置条件
                </button>
                <div className="w-[1px] h-4 bg-zinc-200" /> {/* 分割线 */}
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-all shadow-md shadow-zinc-200"
                >
                  应用筛选
                </button>
              </div>
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
