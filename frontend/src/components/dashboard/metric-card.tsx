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
  return (
    <Card className="min-h-40 p-5 transition-colors hover:border-[var(--primary)]/40 xl:p-6">
      <div className="flex items-start gap-4">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", toneStyles[tone])}>
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">{description}</p>
        </div>
      </div>
    </Card>
  );
}
