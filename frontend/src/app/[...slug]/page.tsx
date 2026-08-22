import { ConfiguredPagePlaceholder } from "@/components/navigation/configured-page-placeholder";
import { SystemConfigPage } from "@/components/settings/system-config-page";

export default async function ConfiguredPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;

  if (path === "/settings/system-config") return <SystemConfigPage />;
  return <ConfiguredPagePlaceholder path={path} />;
}
