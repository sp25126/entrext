import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'vibrant'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-white text-black hover:bg-white/90 shadow-xl shadow-white/5",
      vibrant: "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white hover:opacity-90 shadow-xl shadow-purple-500/20",
      secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/5",
      outline: "border border-white/10 bg-transparent hover:bg-white/5 text-white/70 hover:text-white",
      ghost: "hover:bg-white/5 text-white/50 hover:text-white"
    }

    const sizes = {
      default: "h-11 px-6 py-2 text-sm",
      sm: "h-9 px-4 py-1.5 text-xs",
      lg: "h-14 px-10 py-3 text-base",
      icon: "h-10 w-10"
    }
    
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-full font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
