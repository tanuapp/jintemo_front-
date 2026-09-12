import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "@/components/admin/product-editor";
export const Route = createFileRoute("/admin/products/new")({
  validateSearch: (s: Record<string, unknown>): { section?: string | undefined } => ({
    section: typeof s["section"] === "string" ? s["section"] : undefined,
  }),
  component: Page,
});
function Page() {
  const { section } = Route.useSearch();
  return <ProductEditorPage section={section} />;
}
