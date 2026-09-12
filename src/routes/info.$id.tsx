import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ContentItem } from "@/lib/settings";
import { Loading, DataError } from "@/components/admin/shared";
export const Route = createFileRoute("/info/$id")({ component: Info });
function Info() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["content", id],
    queryFn: () => api<{ item: ContentItem }>(`/content/${id}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <DataError error={q.error.message} />;
  const item = q.data!.item;
  return (
    <article className="container-page max-w-4xl py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">{item.title}</h1>
      {item.subtitle && <p className="mt-4 text-lg text-muted-foreground">{item.subtitle}</p>}
      {item.image && (
        <img
          className="mt-7 max-h-[500px] w-full rounded-xl object-cover"
          src={item.image}
          alt={item.title}
        />
      )}
      <div className="mt-8 whitespace-pre-wrap break-words text-base leading-8">{item.body}</div>
      {item.link && (
        <a href={item.link} className="mt-6 inline-block font-medium text-accent">
          Дэлгэрэнгүй →
        </a>
      )}
    </article>
  );
}
