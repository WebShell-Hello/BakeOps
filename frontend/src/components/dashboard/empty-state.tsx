import { type LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)]">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">{description}</p>
    </div>
  );
}
