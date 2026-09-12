import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageTitle, Panel, Loading, DataError, Empty } from "@/components/admin/shared";
export const Route = createFileRoute("/admin/audit")({ component: Audit });
function Audit() {
  const q = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () =>
      api<{
        audit: { _id: string; userId: string; action: string; target: string; createdAt: string }[];
      }>("/admin/audit"),
  });
  return (
    <>
      <PageTitle title="Үйлдлийн түүх" description="Сүүлийн 200 удирдлагын өөрчлөлт." />
      <Panel>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <DataError error={q.error.message} retry={q.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-3">Огноо</th>
                  <th>Үйлдэл</th>
                  <th>Өөрчилсөн мэдээлэл</th>
                  <th>Хэрэглэгчийн ID</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.audit.map((a) => (
                  <tr className="border-t border-border" key={a._id}>
                    <td className="py-3">{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{a.action}</td>
                    <td>{a.target}</td>
                    <td>{a.userId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!q.data?.audit.length && <Empty />}
          </div>
        )}
      </Panel>
    </>
  );
}
