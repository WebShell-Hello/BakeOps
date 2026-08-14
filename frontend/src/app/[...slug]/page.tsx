import { ConfiguredPagePlaceholder } from "@/components/navigation/configured-page-placeholder";

export default async function ConfiguredPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;

  return <ConfiguredPagePlaceholder path={path} />;
}
