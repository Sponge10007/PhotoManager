import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { photosApi } from '@/api/photos'
import { 
  ChevronLeft, Calendar, Camera, Cpu, 
  MapPin, Tag, Trash2, Edit3, Download, 
  Info, Maximize2, Clock, Layers
} from 'lucide-react'

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
          <img
            src={photo.path}
            alt={photo.title}
            className="max-w-full max-h-[85vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm transition-transform duration-500"
          />
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
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black tracking-tight text-foreground">{photo.title || '未命名图片'}</h2>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                  <Edit3 size={18} />
                </button>
                <button className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {photo.description || '暂无描述信息'}
            </p>
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
            <div className="flex flex-wrap gap-2">
              {photo.tags.length > 0 ? (
                photo.tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      tag.type === 'AI'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {tag.name}
                    {tag.type === 'AI' && <Cpu size={12} />}
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
                <ExifRow icon={<Camera size={16} />} label="设备" value={photo.exif.cameraModel ? `${photo.exif.cameraMake} ${photo.exif.cameraModel}` : '未知设备'} />
                <ExifRow icon={<Layers size={16} />} label="镜头" value={photo.exif.lensModel || '未知镜头'} />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <ExifItem label="ISO" value={photo.exif.iso} />
                  <ExifItem label="光圈" value={photo.exif.aperture ? `f/${photo.exif.aperture}` : '-'} />
                  <ExifItem label="快门" value={photo.exif.shutterSpeed} />
                  <ExifItem label="焦距" value={photo.exif.focalLength ? `${photo.exif.focalLength}mm` : '-'} />
                </div>
                {photo.exif.latitude !== 0 && (
                  <ExifRow icon={<MapPin size={16} />} label="地点" value={`${photo.exif.latitude.toFixed(4)}, ${photo.exif.longitude.toFixed(4)}`} />
                )}
                {photo.exif.takenAt && (
                  <ExifRow icon={<Calendar size={16} />} label="拍摄日期" value={new Date(photo.exif.takenAt).toLocaleString()} />
                )}
              </div>
            </section>
          )}

          {/* 操作按钮 */}
          <section className="pt-4 flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              <Download size={20} /> 下载原图
            </button>
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