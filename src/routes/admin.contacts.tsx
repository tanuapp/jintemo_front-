import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, json } from "@/lib/api";
import {
  PageTitle,
  Panel,
  Loading,
  DataError,
  Empty,
  ConfirmButton,
  useAction,
  inputClass,
} from "@/components/admin/shared";
export const Route = createFileRoute("/admin/contacts")({ component: Contacts });
type Contact = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
};
function Contacts() {
  const { busy, run } = useAction();
  const q = useQuery({
    queryKey: ["admin", "contacts"],
    queryFn: () => api<{ contacts: Contact[] }>("/admin/contacts"),
  });
  return (
    <>
      <PageTitle title="Зурвасууд" />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <DataError error={q.error.message} retry={q.refetch} />
      ) : (
        <div className="space-y-4">
          {q.data?.contacts.map((c) => (
            <Panel key={c._id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold">{c.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.phone} · {c.email} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Зурвасын төлөв"
                    disabled={busy}
                    className={inputClass}
                    value={c.status}
                    onChange={(e) =>
                      run(async () => {
                        await api(
                          `/admin/contacts/${c._id}`,
                          json("PATCH", { status: e.target.value }),
                        );
                        await q.refetch();
                      })
                    }
                  >
                    <option value="new">Шинэ</option>
                    <option value="read">Уншсан</option>
                    <option value="closed">Шийдвэрлэсэн</option>
                  </select>
                  <ConfirmButton
                    onConfirm={async () => {
                      await api(`/admin/contacts/${c._id}`, { method: "DELETE" });
                      await q.refetch();
                    }}
                  />
                </div>
              </div>
              <p className="mt-5 whitespace-pre-wrap leading-7">{c.message}</p>
            </Panel>
          ))}
          {!q.data?.contacts.length && (
            <Panel>
              <Empty />
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
