import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthPanel } from "@/components/profile-drawer";
import { useAuth } from "@/lib/auth";
import { Loading, DataError } from "@/components/admin/shared";
export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Нэвтрэх | JINTEMO" }] }),
});
function Login() {
  const { user, ready, error, refresh } = useAuth();
  if (!ready) return <Loading />;
  if (error) return <DataError error={error} retry={refresh} />;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} />;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-6 font-display text-3xl font-bold">Тавтай морил</h1>
      <AuthPanel onDone={() => {}} />
    </div>
  );
}
