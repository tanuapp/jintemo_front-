import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Btn, EmptyState, Field, TextInput } from "@/components/ui-kit";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useUi } from "@/lib/ui-store";

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [{ title: "Миний мэдээлэл | JINTEMO" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, ready, updateProfile, changePassword } = useAuth();
  const { openProfile } = useUi();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setEmail(user.email ?? "");
  }, [user]);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={UserRound}
          title="Та нэвтрээгүй байна"
          description="Профайлаа харахын тулд эхлээд нэвтэрнэ үү."
          action={<Btn onClick={openProfile}>Нэвтрэх</Btn>}
        />
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-8 pb-16">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} className="h-12 w-12 bg-accent/10 text-base text-accent" />
        <div>
          <h1 className="font-display text-2xl font-extrabold">Миний мэдээлэл</h1>
          <p className="text-sm text-muted-foreground">Хувийн мэдээллээ шинэчлэх</p>
        </div>
      </div>

      <section className="mt-8 border-t border-border pt-6">
        <div className="max-w-xl">
          <h2 className="font-display text-lg font-bold">Хувийн мэдээлэл</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Захиалга болон хүргэлтэд ашиглах мэдээлэл.
          </p>
          <div className="mt-5 space-y-4">
            <Field label="Нэр">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Утасны дугаар">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </Field>
            <Field label="Имэйл">
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </Field>
            <Btn
              onClick={async () => {
                try {
                  await updateProfile({ name, phone, email });
                  toast.success("Мэдээлэл хадгалагдлаа");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Хадгалах
            </Btn>
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <div className="max-w-xl">
          <h2 className="font-display text-lg font-bold">Нууц үг</h2>
          <p className="mt-1 text-sm text-muted-foreground">Бүртгэлийн нууц үгээ шинэчлэх.</p>
          <div className="mt-5 space-y-4">
            <Field label="Одоогийн нууц үг">
              <TextInput
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                type="password"
              />
            </Field>
            <Field label="Шинэ нууц үг">
              <TextInput
                value={nextPw}
                onChange={(e) => setNextPw(e.target.value)}
                type="password"
              />
            </Field>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            <Btn
              variant="secondary"
              onClick={async () => {
                const result = await changePassword(currentPw, nextPw);
                if (!result.ok) {
                  setPwError(result.error);
                  return;
                }
                setPwError(null);
                setCurrentPw("");
                setNextPw("");
                toast.success("Нууц үг солигдлоо");
              }}
            >
              Нууц үг солих
            </Btn>
          </div>
        </div>
      </section>
    </div>
  );
}
