import {
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  Circle,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const iconRegistry: Record<string, LucideIcon> = {
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  UsersRound,
};

export function NavigationIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = iconRegistry[iconKey] ?? Circle;
  return <Icon className={cn("shrink-0", className)} strokeWidth={1.9} />;
}
