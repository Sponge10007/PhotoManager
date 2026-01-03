import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Mail, Lock, LogIn, Camera } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.token)
      navigate('/')
    },
    onError: (error: any) => {
      // 增强错误提示体验
      const errorMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        '登录失败，请检查账号密码'
      alert(errorMsg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-hidden">
      {/* 左侧：视觉展示区域 (仅在桌面端显示) */}
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
            记录生活中的每一个精彩瞬间，让 AI 助你高效管理海量照片。
          </p>
        </div>
        <div className="absolute bottom-10 left-12 z-20 text-white/60 text-sm">
          © 2025 Photo Management System · BS课程作业项目
        </div>
      </div>

      {/* 右侧：登录表单区域 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-6">
               <div className="p-3 bg-primary rounded-2xl shadow-lg">
                 <Camera className="text-primary-foreground" size={32} />
               </div>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">欢迎回来</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              请输入您的账号信息以登录系统
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 ml-1">邮箱地址</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-semibold text-foreground/80">登录密码</label>
                  <a href="#" className="text-xs font-medium text-primary hover:underline underline-offset-4">忘记密码？</a>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 border border-transparent rounded-2xl shadow-xl text-base font-bold text-primary-foreground bg-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            >
              {loginMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  登录系统
                </>
              )}
            </button>

            <div className="relative py-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-4 text-muted-foreground font-medium tracking-widest">或者通过以下方式</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-border bg-card rounded-2xl hover:bg-secondary/80 transition-all text-sm font-bold shadow-sm active:scale-95">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.132,0-5.682-2.55-5.682-5.682s2.55-5.682,5.682-5.682c1.354,0,2.558,0.481,3.513,1.268l2.545-2.545c-1.512-1.412-3.513-2.268-6.058-2.268C6.136,3.123,1,8.259,1,14.672s5.136,11.549,11.545,11.549c6.391,0,11.455-5.136,11.455-11.549c0-0.782-0.064-1.536-0.182-2.268L12.545,10.239z"/></svg>
                Google
              </button>
              <button type="button" className="flex items-center justify-center gap-3 py-3 px-4 border border-border bg-card rounded-2xl hover:bg-secondary/80 transition-all text-sm font-bold shadow-sm active:scale-95">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                GitHub
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground pt-6">
              还没有账号？{' '}
              <Link to="/register" className="font-bold text-primary hover:underline underline-offset-4 hover:text-primary/80 transition-colors">
                立即创建账户
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
