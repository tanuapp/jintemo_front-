import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, json } from "@/lib/api";
import { useAuth, type PublicUser } from "@/lib/auth";
import { Btn } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
export const Route = createFileRoute("/admin/users")({ component: Users });
function Users() {
  const { user, refresh: refreshAuth } = useAuth();
  const qc = useQueryClient();
  const { busy, run } = useAction();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PublicUser | "new" | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    username: "",
    phone: "",
    email: "",
    password: "",
    role: "user",
  });
  const q = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<{ users: PublicUser[] }>("/admin/users"),
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin"] });
  };
  const update = async (u: PublicUser, data: unknown) => {
    await api(`/admin/users/${u.id}`, json("PATCH", data));
    if (u.id === user?.id) await refreshAuth();
    await refresh();
  };
  const open = (u: PublicUser | "new") => {
    setEditing(u);
    setDraft(
      u === "new"
        ? { name: "", username: "", phone: "", email: "", password: "", role: "user" }
        : {
            name: u.name,
            username: u.username,
            phone: u.phone,
            email: u.email || "",
            password: "",
            role: u.role,
          },
    );
  };
  const users = (q.data?.users || []).filter((u) =>
    `${u.name} ${u.username} ${u.phone} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Хэрэглэгчид"
        action={<Btn onClick={() => open("new")}>+ Хэрэглэгч нэмэх</Btn>}
      />
      <Panel>
        <input
          aria-label="Хэрэглэгч хайх"
          placeholder="Нэр, утас, имэйлээр хайх…"
          className={`${inputClass} mb-5 max-w-sm`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <DataError error={q.error.message} retry={q.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">Хэрэглэгч</th>
                  <th>Утас</th>
                  <th>Эрх</th>
                  <th>Төлөв</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-4">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.username} · {u.email}
                      </p>
                    </td>
                    <td>{u.phone}</td>
                    <td>
                      <select
                        aria-label={`${u.name} эрх`}
                        disabled={busy || u.id === user?.id}
                        className="rounded border border-input bg-card p-2"
                        value={u.role}
                        onChange={(e) => run(() => update(u, { role: e.target.value }))}
                      >
                        <option value="user">Хэрэглэгч</option>
                        <option value="admin">Админ</option>
                      </select>
                    </td>
                    <td>
                      <button
                        disabled={busy || u.id === user?.id}
                        className={u.active ? "text-success" : "text-muted-foreground"}
                        onClick={() => run(() => update(u, { active: !u.active }))}
                      >
                        {u.active ? "Идэвхтэй" : "Идэвхгүй"}
                      </button>
                    </td>
                    <td className="text-right">
                      <button className="px-2 text-accent" onClick={() => open(u)}>
                        Засах
                      </button>
                      <ConfirmButton
                        disabled={u.id === user?.id}
                        title={`${u.name} хэрэглэгчийг устгах уу?`}
                        onConfirm={async () => {
                          await api(`/admin/users/${u.id}`, { method: "DELETE" });
                          await refresh();
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <Empty />}
          </div>
        )}
      </Panel>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Хэрэглэгч нэмэх" : "Хэрэглэгч засах"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(async () => {
                  if (editing === "new") await api("/admin/users", json("POST", draft));
                  else if (editing)
                    await update(editing, {
                      name: draft.name,
                      phone: draft.phone,
                      email: draft.email,
                      ...(draft.password ? { password: draft.password } : {}),
                    });
                  await refresh();
                })
              )
                setEditing(null);
            }}
          >
            {(
              [
                ["name", "Нэр"],
                ...(editing === "new" ? [["username", "Нэвтрэх нэр"]] : []),
                ["phone", "Утас"],
                ["email", "Имэйл (заавал биш)"],
                [
                  "password",
                  editing === "new" ? "Нууц үг (8+ тэмдэгт)" : "Шинэ нууц үг (хоосон бол хэвээр)",
                ],
              ] as [keyof typeof draft, string][]
            ).map(([key, label]) => (
              <label className="block text-sm font-medium" key={key}>
                {label}
                <input
                  className={`${inputClass} mt-2`}
                  required={
                    key === "name" ||
                    (editing === "new" && ["username", "phone", "password"].includes(key))
                  }
                  type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                  autoComplete={key === "password" ? "new-password" : "off"}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            {editing === "new" && (
              <label className="block text-sm font-medium">
                Эрх
                <select
                  className={`${inputClass} mt-2`}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                >
                  <option value="user">Хэрэглэгч</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
            )}
            <Btn type="submit" disabled={busy}>
              Хадгалах
            </Btn>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
