import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-[#58cc02] text-white border-b-[#58a700] hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  secondary: "bg-[#1cb0f6] text-white border-b-[#0a8fc7] hover:brightness-105 active:translate-y-[2px] active:border-b-0",
  ghost: "bg-white text-[#4b4b4b] border-2 border-[#e5e5e5] border-b-[3px] hover:bg-[#f7f7f7] active:translate-y-[2px] active:border-b-[2px]",
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
