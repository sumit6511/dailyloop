import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";
import { buttonClasses, type ButtonStyleProps } from "./button-styles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", isLoading, className = "", disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {isLoading ? <Spinner className="h-4 w-4" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
