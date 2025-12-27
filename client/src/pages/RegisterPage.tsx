import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Mail, Lock, UserPlus, Camera, User, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data.user, data.token)
      navigate('/')
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.message || '注册失败，请检查填写内容'
      alert(errorMsg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    registerMutation.mutate({ username, email, password })
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-hidden">
      {/* 左侧：视觉展示区域 (与登录页保持完全一致) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 bg-black/30 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&q=80&w=2070" 
          alt="Photography Background" 
          className="absolute inset-0 w-full h-full object-cover transform scale-105"
        />
        <div className="relative z-20 m-auto p-12 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl">
              <Camera size={40} />
            </div>
            <h1 className="text-5xl font-black tracking-tighter">PhotoMS</h1>
          </div>
          <p className="text-xl text-white/90 max-w-md leading-relaxed font-light">
            开启您的视觉管理之旅。只需几秒钟即可加入我们。
          </p>
        </div>
        <div className="absolute bottom-10 left-12 z-20 text-white/60 text-sm">
          © 2025 Photo Management System · BS课程作业项目
        </div>
      </div>

      {/* 右侧：注册表单区域 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-10 py-12">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-6">
               <div className="p-3 bg-primary rounded-2xl shadow-lg">
                 <Camera className="text-primary-foreground" size={32} />
               </div>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">创建新账户</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              填写以下信息以开始管理您的摄影作品
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* 用户名 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 ml-1">用户名称</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="您的昵称"
                    className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* 邮箱 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 ml-1">电子邮箱</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 ml-1">设置密码</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 个字符"
                    className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 ml-1 flex items-center gap-1">
                  <ArrowRight size={10} /> 建议使用包含字母和数字的强密码
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 border border-transparent rounded-2xl shadow-xl text-base font-bold text-primary-foreground bg-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {registerMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={20} />
                  立即注册
                </>
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground pt-6">
              已经有账户了？{' '}
              <Link to="/login" className="font-bold text-primary hover:underline underline-offset-4 hover:text-primary/80 transition-colors">
                返回登录
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}