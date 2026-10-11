import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button ref={ref} {...props} className={`px-4 py-2 bg-black text-white rounded-md ${className || ""}`}>
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
