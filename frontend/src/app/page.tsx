import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { getHealthStatus, type HealthStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await loadHealthStatus();

  return <DashboardPage health={health} nowIso={new Date().toISOString()} />;
}

async function loadHealthStatus(): Promise<HealthStatus> {
  try {
    return await getHealthStatus();
  } catch {
    return { status: "unavailable", database: "unavailable" };
  }
}
