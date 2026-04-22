import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** When true, removes internal padding — use for custom-layout cards like product photos that fill the card. */
  flush?: boolean;
}

export function Card({ children, className, flush = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-paper border rule",
        !flush && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
