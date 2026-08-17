import { HomeGate } from "@/components/auth/home-gate";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <HomeGate />;
}
