import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  children: React.ReactNode
}

export default function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-md border border-gray-200/50 transition-all duration-300 ease-out',
        hover && 'cursor-pointer hover:-translate-y-2 hover:shadow-2xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
