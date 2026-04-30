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

/**
 * Locked brand callout variants (spec §16.1, §16.4 RUO is high-importance):
 *   - info  → paper-soft cream surface, gold-dark rule
 *   - warn  → paper-soft surface, danger rule, ink text
 *   - ruo   → wine surface, gold accent rule, paper text
 *             (RUO is a compliance surface and must remain visually distinct)
 */
type VariantConfig = {
  icon: typeof Info;
  surface?: "wine";
  containerClasses: string;
  titleClasses: string;
  bodyClasses: string;
};

const VARIANT_CONFIG: Record<Variant, VariantConfig> = {
  info: {
    icon: Info,
    containerClasses: "border-l-4 border-l-gold-dark bg-paper-soft text-ink",
    titleClasses: "text-ink",
    bodyClasses: "text-ink-soft",
  },
  warn: {
    icon: AlertTriangle,
    containerClasses: "border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft text-ink",
    titleClasses: "text-ink",
    bodyClasses: "text-ink-soft",
  },
  ruo: {
    icon: AlertTriangle,
    surface: "wine",
    containerClasses: "border-l-4 border-l-gold bg-wine text-paper",
    titleClasses: "text-paper",
    bodyClasses: "text-paper/85",
  },
};

export function Callout({ variant = "info", title, children, className }: CalloutProps) {
  const config = VARIANT_CONFIG[variant];
  const { icon: Icon, surface, containerClasses, titleClasses, bodyClasses } = config;
  return (
    <div
      role="note"
      data-surface={surface}
      className={cn(
        // v2 radius scale (Foundation Q3): rounded-md = 16px
        "p-5 flex gap-4 rounded-md",
        containerClasses,
        className
      )}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.5} />
      <div className="flex flex-col gap-1.5 text-sm">
        {title && <div className={cn("font-medium", titleClasses)}>{title}</div>}
        <div className={cn("leading-relaxed", bodyClasses)}>{children}</div>
      </div>
    </div>
  );
}
