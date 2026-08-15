import { type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles = {
  blue: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-fg)]",
  green: "bg-[var(--tone-green-bg)] text-[var(--tone-green-fg)]",
  amber: "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)]",
  violet: "bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)]",
  rose: "bg-[var(--tone-rose-bg)] text-[var(--tone-rose-fg)]",
} as const;

type MetricCardProps = {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
  value: string;
  description: string;
};

export function MetricCard({ label, icon: Icon, tone, value, description }: MetricCardProps) {
  const compactValue = value.replace(/\s/g, "");
  const valueSize =
    compactValue.length > 15
      ? "text-xs"
      : compactValue.length > 12
        ? "text-sm"
        : compactValue.length > 9
          ? "text-lg"
          : compactValue.length > 7
            ? "text-xl"
            : "text-2xl";

  return (
    <Card className="flex h-full min-h-36 flex-col p-4 transition-colors hover:border-[var(--primary)]/40 xl:p-5">
      <div className="flex min-h-10 items-center gap-2.5">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", toneStyles[tone])}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <p className="line-clamp-2 min-w-0 text-xs font-medium leading-4 text-[var(--muted)]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 flex h-8 w-full items-center whitespace-nowrap font-semibold leading-none tabular-nums",
          valueSize,
        )}
        title={value}
      >
        {value}
      </p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">
        {description}
      </p>
    </Card>
  );
}
