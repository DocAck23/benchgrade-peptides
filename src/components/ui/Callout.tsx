import { type ReactNode } from "react";
import { Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "info" | "warn" | "ruo";

interface CalloutProps {
  variant?: Variant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const VARIANT_CONFIG: Record<Variant, { icon: typeof Info; classes: string }> = {
  info: {
    icon: Info,
    classes: "border-l-teal bg-teal-soft text-ink",
  },
  warn: {
    icon: AlertTriangle,
    classes: "border-l-[color:var(--color-warn)] bg-paper-soft text-ink",
  },
  ruo: {
    icon: AlertTriangle,
    classes: "border-l-oxblood bg-paper-soft text-ink",
  },
};

export function Callout({ variant = "info", title, children, className }: CalloutProps) {
  const { icon: Icon, classes } = VARIANT_CONFIG[variant];
  return (
    <div
      role="note"
      className={cn(
        "border-l-4 p-5 flex gap-4",
        classes,
        className
      )}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.5} />
      <div className="flex flex-col gap-1.5 text-sm">
        {title && <div className="font-medium text-ink">{title}</div>}
        <div className="text-ink-soft leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
