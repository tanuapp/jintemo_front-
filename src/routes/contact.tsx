import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api, json } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Btn } from "@/components/ui-kit";
import { inputClass, useAction } from "@/components/admin/shared";
export const Route = createFileRoute("/contact")({ component: Contact });
function Contact() {
  const { settings } = useSettings();
  const { busy, run } = useAction();
  const [d, setD] = useState({ name: "", phone: "", email: "", message: "" });
  return (
    <div className="container-page grid gap-10 py-12 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-bold">Холбоо барих</h1>
        <p className="mt-6 leading-8">
          {settings.address}
          <br />
          {settings.hours}
        </p>
        <a
          href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}
          className="mt-5 inline-block text-xl font-semibold text-accent"
        >
          {settings.phone}
        </a>
        {settings.email && <p className="mt-3">{settings.email}</p>}
      </div>
      <form
        className="space-y-4 rounded-xl border border-border bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/contact", json("POST", d)), "Зурвас илгээгдлээ"))
            setD({ name: "", phone: "", email: "", message: "" });
        }}
      >
        {(["name", "phone", "email"] as const).map((key) => (
          <label className="block text-sm font-medium" key={key}>
            {{ name: "Нэр", phone: "Утас", email: "Имэйл (заавал биш)" }[key]}
            <input
              required={key !== "email"}
              type={key === "email" ? "email" : "text"}
              className={`${inputClass} mt-2`}
              value={d[key]}
              onChange={(e) => setD({ ...d, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm font-medium">
          Зурвас
          <textarea
            required
            minLength={5}
            className={`${inputClass} mt-2 min-h-36 py-3`}
            value={d.message}
            onChange={(e) => setD({ ...d, message: e.target.value })}
          />
        </label>
        <Btn type="submit" disabled={busy}>
          {busy ? "Илгээж байна…" : "Илгээх"}
        </Btn>
      </form>
    </div>
  );
}
