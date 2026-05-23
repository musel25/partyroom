import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-duo-green text-white border-b-duo-green-dk hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  secondary: "bg-duo-blue text-white border-b-duo-blue-dk hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  ghost: "bg-white text-[#4b4b4b] border-2 border-duo-border border-b-[3px] hover:bg-duo-soft active:translate-y-[2px] active:border-b-[2px]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function DuoButton({ variant = "primary", className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-xl px-5 py-3 font-bold uppercase tracking-wide text-sm transition-all",
        "border-b-[4px] disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
