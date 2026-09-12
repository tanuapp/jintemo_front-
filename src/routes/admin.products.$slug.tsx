import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "@/components/admin/product-editor";
export const Route = createFileRoute("/admin/products/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams();
  return <ProductEditorPage slug={slug} />;
}
