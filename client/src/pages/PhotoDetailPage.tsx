import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { photosApi } from '@/api/photos'
import type { Tag as PhotoTag, UpdatePhotoRequest } from '@/types'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  ChevronLeft, Calendar, Camera, Cpu,
  MapPin, Tag, Trash2, Edit3, Download,
  Info, Maximize2, Clock, Layers, 
  SlidersHorizontal,
  Sparkles,            
} from 'lucide-react'

export default function PhotoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: photo, isLoading } = useQuery({
    queryKey: ['photo', id],
    queryFn: () => photosApi.getPhotoById(id!),
    enabled: !!id,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftTags, setDraftTags] = useState<PhotoTag[]>([])
  const [newTag, setNewTag] = useState('')
  const [isImageEditing, setIsImageEditing] = useState(false)
  const [filters, setFilters] = useState({ brightness: 0, contrast: 0, saturation: 0 })
  const [cropEnabled, setCropEnabled] = useState(true)
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePhotoRequest) => photosApi.updatePhoto(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo', id] })
      queryClient.invalidateQueries({ queryKey: ['photos'] })
      setIsEditing(false)
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || '更新失败，请重试')
    },
  })

  // 删除照片mutation
  const deleteMutation = useMutation({
    mutationFn: () => photosApi.deletePhoto(id!),
    onSuccess: () => {
      // 删除成功后，清除缓存并跳转回首页
      queryClient.invalidateQueries({ queryKey: ['photos'] })
      navigate('/')
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '删除失败，请重试')
    },
  })

  const aiTagsMutation = useMutation({
    mutationFn: () => photosApi.generateAITags(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo', id] })
      queryClient.invalidateQueries({ queryKey: ['photos'] })
      alert('AI 标签已更新')
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'AI 标签生成失败，请重试')
    },
  })

  // 处理删除
  const handleDelete = () => {
    if (window.confirm('确定要删除这张图片吗？此操作无法撤销！')) {
      deleteMutation.mutate()
    }
  }

  // 处理编辑保存
  const saveImageEdit = async () => {
    try {
      const cropPayload = (() => {
        if (!cropEnabled || !imageRef.current) {
          return { cropX: 0, cropY: 0, cropW: 0, cropH: 0 }
        }

        const image = imageRef.current
        const rect = image.getBoundingClientRect()
        if (!rect.width || !rect.height || !image.naturalWidth || !image.naturalHeight) {
          return { cropX: 0, cropY: 0, cropW: 0, cropH: 0 }
        }

        const scaleX = image.naturalWidth / rect.width
        const scaleY = image.naturalHeight / rect.height

        const pixelCrop: PixelCrop | null =
          completedCrop ?? ({
            unit: 'px',
            x: ((crop.x ?? 0) / 100) * rect.width,
            y: ((crop.y ?? 0) / 100) * rect.height,
            width: ((crop.width ?? 0) / 100) * rect.width,
            height: ((crop.height ?? 0) / 100) * rect.height,
          } as PixelCrop)

        if (!pixelCrop.width || !pixelCrop.height) {
          return { cropX: 0, cropY: 0, cropW: 0, cropH: 0 }
        }

        return {
          cropX: Math.round(pixelCrop.x * scaleX),
          cropY: Math.round(pixelCrop.y * scaleY),
          cropW: Math.round(pixelCrop.width * scaleX),
          cropH: Math.round(pixelCrop.height * scaleY),
        }
      })()

      // 修正：只传 id，不传完整路径。注意：后端需要 cropX, cropY 等参数
      const data = await photosApi.editPhoto(id!, {
        ...filters,
        ...cropPayload,
      })
      alert('编辑成功，已生成新图片！')
      
      // 修正：axios 拦截器通常返回 data 本身，所以使用 data.id
      navigate(`/photo/${data.id}`) 
      setIsImageEditing(false)
    } catch (err: any) {
      alert(err.response?.data?.error || '编辑失败')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!photo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Info size={48} strokeWidth={1} className="mb-4" />
        <p className="text-xl">未找到该图片</p>
        <button onClick={() => navigate('/')} className="mt-6 text-primary hover:underline">返回图库</button>
      </div>
    )
  }

  const beginEdit = () => {
    setDraftTitle(photo.title || '')
    setDraftDescription(photo.description || '')
    setDraftTags(photo.tags || [])
    setNewTag('')
    setIsEditing(true)
  }

  const addTag = () => {
    const tagName = newTag.trim()
    if (!tagName) return

    const exists = draftTags.some((t) => t.name.toLowerCase() === tagName.toLowerCase())
    if (!exists) {
      setDraftTags([...draftTags, { name: tagName, source: 'USER' }])
    }
    setNewTag('')
  }

  const removeTagAt = (index: number) => {
    setDraftTags(draftTags.filter((_, i) => i !== index))
  }

  const saveEdits = () => {
    updateMutation.mutate({
      title: draftTitle,
      description: draftDescription,
      tags: draftTags,
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col lg:flex-row overflow-hidden">
      {/* 顶部导航 (移动端优先) */}
      <header className="lg:hidden p-4 flex items-center gap-4 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold truncate">{photo.title || '详情'}</h1>
      </header>

      {/* 左侧：图片展示区 (沉浸式) */}
      <div className="flex-1 relative flex items-center justify-center p-4 lg:p-12 overflow-hidden bg-black">
        <button 
          onClick={() => navigate('/')} 
          className="hidden lg:flex absolute top-8 left-8 items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all text-sm font-medium z-10"
        >
          <ChevronLeft size={18} /> 返回图库
        </button>

        <div className="relative group max-w-full max-h-full">
          {isImageEditing && cropEnabled ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              keepSelection
              ruleOfThirds
            >
              <img
                ref={imageRef}
                src={photo.path}
                alt={photo.title}
                style={{
                  filter: `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)`,
                }}
                className="max-w-full max-h-[85vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm"
              />
            </ReactCrop>
          ) : (
            <img
              ref={imageRef}
              src={photo.path}
              alt={photo.title}
              style={{
                filter: `brightness(${100 + filters.brightness}%) contrast(${100 + filters.contrast}%) saturate(${100 + filters.saturation}%)`,
              }}
              className="max-w-full max-h-[85vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm transition-transform duration-500"
            />
          )}
          <button className="absolute bottom-4 right-4 p-3 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* 右侧：信息面板 */}
      <aside className="w-full lg:w-[400px] h-screen overflow-y-auto bg-card border-l border-white/5 flex flex-col">
        <div className="p-8 space-y-8">
          {/* 基本信息 */}
          <section>
            <div className="mb-4">
              {isEditing ? (
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full text-2xl font-black tracking-tight text-foreground bg-transparent border-b border-border/50 focus:outline-none focus:border-primary"
                  placeholder="标题"
                />
              ) : (
                <h2 className="text-2xl font-black tracking-tight text-foreground break-words">
                  {photo.title || '未命名图片'}
                </h2>
              )}

              {/* 操作栏：与标题分行，避免拥挤 */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!isEditing && !isImageEditing && (
                  <button
                    onClick={() => {
                      setIsImageEditing(true)
                      setFilters({ brightness: 0, contrast: 0, saturation: 0 })
                      setCropEnabled(true)
                      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
                      setCompletedCrop(null)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
                    title="编辑图片色调"
                  >
                    <SlidersHorizontal size={18} strokeWidth={2.25} />
                    <span>编辑色调</span>
                  </button>
                )}

                {!isEditing && !isImageEditing && (
                  <button
                    onClick={() => aiTagsMutation.mutate()}
                    disabled={aiTagsMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                    title="AI 生成标签"
                  >
                    <Sparkles size={18} strokeWidth={2.25} />
                    <span>AI 生成标签</span>
                  </button>
                )}
                
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdits}
                      disabled={updateMutation.isPending}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-2 hover:bg-secondary rounded-xl text-xs font-bold text-muted-foreground"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  /* 编辑按钮更名为“添加描述” */
                  <button
                    onClick={beginEdit}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/50"
                    title="修改标题与描述"
                  >
                    <Edit3 size={18} strokeWidth={2.25} />
                    <span>添加描述</span>
                  </button>
                )}
                
                <button onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="ml-auto inline-flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                      >
                  <Trash2 size={18} strokeWidth={2.25} />
                  <span>删除</span>
                </button>
              </div>
            </div>
            {isEditing ? (
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                className="w-full text-muted-foreground leading-relaxed bg-secondary/30 rounded-xl p-3 border border-border/50 focus:outline-none focus:border-primary min-h-[96px]"
                placeholder="描述"
              />
            ) : (
              <p className="text-muted-foreground leading-relaxed">
                {photo.description || '暂无描述信息'}
              </p>
            )}
          </section>

          {/* 快捷统计/元数据卡片 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/50 rounded-2xl">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-bold uppercase tracking-wider">
                <Clock size={12} /> 上传于
              </div>
              <p className="text-sm font-medium">{new Date(photo.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-2xl">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs font-bold uppercase tracking-wider">
                <Layers size={12} /> 大小
              </div>
              <p className="text-sm font-medium">{(photo.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>

          {/* 标签部分 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              <Tag size={16} /> 标签
            </h3>
            {isEditing && (
              <div className="mb-4 flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  className="flex-1 bg-secondary/30 rounded-xl px-3 py-2 text-sm text-foreground border border-border/50 focus:outline-none focus:border-primary"
                  placeholder="添加标签（回车确认）"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90"
                >
                  添加
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(isEditing ? draftTags : photo.tags) && (isEditing ? draftTags : photo.tags)!.length > 0 ? (
                (isEditing ? draftTags : photo.tags)!.map((tag, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      tag.source === 'AI'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {tag.name}
                    {tag.source === 'AI' && <Cpu size={12} />}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeTagAt(index)}
                        className="ml-1 text-[10px] opacity-70 hover:opacity-100"
                        aria-label="Remove tag"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">尚无标签</p>
              )}
            </div>
          </section>

          {/* EXIF 技术细节 */}
          {photo.exif && (
            <section className="bg-secondary/30 rounded-3xl p-6 border border-white/5">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">
                <Info size={16} /> 拍摄参数 (EXIF)
              </h3>
              <div className="space-y-4">
                <ExifRow icon={<Camera size={16} />} label="设备" value={photo.exif.model ? `${photo.exif.make || ''} ${photo.exif.model}`.trim() : '未知设备'} />
                <ExifRow icon={<Layers size={16} />} label="镜头" value={photo.exif.lens || '未知镜头'} />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <ExifItem label="ISO" value={photo.exif.iso} />
                  <ExifItem label="光圈" value={photo.exif.aperture ? `f/${photo.exif.aperture}` : '-'} />
                  <ExifItem label="快门" value={photo.exif.shutterSpeed} />
                  <ExifItem label="焦距" value={photo.exif.focalLength ? `${photo.exif.focalLength}mm` : '-'} />
                </div>
                {photo.exif.gps && photo.exif.gps.latitude !== 0 && (
                  <ExifRow icon={<MapPin size={16} />} label="地点" value={`${photo.exif.gps.latitude.toFixed(4)}, ${photo.exif.gps.longitude.toFixed(4)}`} />
                )}
                {photo.exif.takenAt && (
                  <ExifRow icon={<Calendar size={16} />} label="拍摄日期" value={new Date(photo.exif.takenAt).toLocaleString()} />
                )}
              </div>
            </section>
          )}

          {isImageEditing && (
            <section className="bg-secondary/30 rounded-3xl p-6 border border-primary/20 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary mb-2">
                <Cpu size={16} /> 色调调节
              </h3>
              
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">裁剪</div>
                <button
                  type="button"
                  onClick={() => setCropEnabled((v) => !v)}
                  className="px-3 py-1.5 bg-secondary rounded-xl text-xs font-bold hover:opacity-90"
                >
                  {cropEnabled ? '关闭裁剪' : '启用裁剪'}
                </button>
              </div>
              {cropEnabled && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>在左侧图片上拖拽选择裁剪区域</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
                      setCompletedCrop(null)
                    }}
                    className="px-3 py-1.5 bg-secondary rounded-xl text-xs font-bold hover:opacity-90"
                  >
                    重置
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label>亮度</label>
                    <span className={filters.brightness >= 0 ? "text-primary" : "text-destructive"}>
                      {filters.brightness > 0 ? `+${filters.brightness}` : filters.brightness}
                    </span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" step="1"
                    value={filters.brightness}
                    onChange={(e) => setFilters({ ...filters, brightness: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label>对比度</label>
                    <span className={filters.contrast >= 0 ? "text-primary" : "text-destructive"}>
                      {filters.contrast > 0 ? `+${filters.contrast}` : filters.contrast}
                    </span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" step="1"
                    value={filters.contrast}
                    onChange={(e) => setFilters({ ...filters, contrast: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <label>饱和度</label>
                    <span className={filters.saturation >= 0 ? "text-primary" : "text-destructive"}>
                      {filters.saturation > 0 ? `+${filters.saturation}` : filters.saturation}
                    </span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" step="1"
                    value={filters.saturation}
                    onChange={(e) => setFilters({ ...filters, saturation: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveImageEdit}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90"
                >
                  应用并另存
                </button>
                <button
                  onClick={() => {
                    setIsImageEditing(false);
                    setFilters({ brightness: 0, contrast: 0, saturation: 0 }); // 重置
                    setCropEnabled(true)
                    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })
                    setCompletedCrop(null)
                  }}
                  className="px-4 py-2 bg-secondary rounded-xl text-xs font-bold"
                >
                  取消
                </button>
              </div>
            </section>
          )}

          {/* 操作按钮 */}
          <section className="pt-4 flex gap-4">
            <a
              href={photo.path}
              download={photo.fileName}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              <Download size={20} /> 下载原图
            </a>
          </section>
        </div>
      </aside>
    </div>
  )
}

// 辅助组件：EXIF 行
function ExifRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-primary">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

// 辅助组件：EXIF 小项
function ExifItem({ label, value }: { label: string, value: string | number | undefined }) {
  return (
    <div className="bg-background/50 p-3 rounded-2xl border border-white/5">
      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground">{value || 'N/A'}</p>
    </div>
  )
}
