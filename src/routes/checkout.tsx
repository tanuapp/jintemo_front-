import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  PackageCheck,
  Pencil,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Btn, Field, OptionCard, SummaryRow, TextArea, TextInput } from "@/components/ui-kit";
import { useAuth, type Address } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog-store";
import { m2, mnt } from "@/lib/format";
import { INSTALL_PRICE_TBD } from "@/lib/products";
import { computeTotals, itemArea, itemTotal, useCart } from "@/lib/store";
import { errorMessage, ApiError } from "@/lib/api";
import { useSettings, installationRate } from "@/lib/settings";
import { AuthPanel } from "@/components/profile-drawer";
import { Loading, DataError } from "@/components/admin/shared";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Захиалга баталгаажуулах | JINTEMO" },
      { name: "description", content: "4 алхмаар захиалгаа баталгаажуулна уу." },
      { property: "og:title", content: "Захиалга баталгаажуулах | JINTEMO" },
      {
        property: "og:description",
        content: "Мэдээлэл, суурилуулалт, хүргэлт, төлбөрийн сонголт.",
      },
    ],
  }),
  component: Checkout,
});

const steps = ["Мэдээлэл", "Суурилуулалт", "Хүргэлт", "Төлбөр"];
const payments = [
  { id: "Банкны шилжүүлэг", icon: Wallet, desc: "Дансны мэдээллийг захиалгын дараа илгээнэ." },
  { id: "Хүргэлтээр төлөх", icon: Banknote, desc: "Бараа хүлээн авахдаа бэлнээр эсвэл картаар." },
];

const NEW_ADDRESS = "__new__";

function formatAddress(a: Address) {
  return [a.district, a.khoroo, a.address, a.note].filter((p) => p && p.trim()).join(", ");
}

/** Compact connected progress indicator, shown at the top of the checkout card. */
function CheckoutSteps({ step, installSelected }: { step: number; installSelected: boolean }) {
  return (
    <ol className="mt-6 flex items-center">
      {steps.map((label, i) => {
        // Хүргэлт (index 2) is auto-handled — not blocked — when installation is selected.
        const skipped = i === 2 && installSelected;
        const done = i < step || (skipped && step >= 1);
        const current = i === step;
        const last = i === steps.length - 1;
        return (
          <li key={label} className={cn("flex items-center", !last && "flex-1")}>
            <span className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors sm:h-7 sm:w-7 sm:text-xs",
                  done
                    ? "border-transparent bg-success/10 text-success"
                    : current
                      ? "border-transparent bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs sm:text-[13px]",
                  current
                    ? "font-semibold text-foreground"
                    : cn("hidden sm:inline", done ? "text-foreground/60" : "text-muted-foreground"),
                )}
              >
                {skipped ? "Хүргэлт — үнэгүй" : label}
              </span>
            </span>
            {!last && (
              <span
                aria-hidden
                className={cn("mx-2 h-px flex-1", i < step ? "bg-success/40" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Checkout() {
  const navigate = useNavigate();
  const { items, ready, cartError, syncCart, placeOrder } = useCart();
  const { settings } = useSettings();
  const DELIVERY_PRICE = settings.deliveryPrice;
  const INSTALL_RATE_LABEL = installationRate(settings);
  const INSTALL_PRICE_NOTE = `${INSTALL_RATE_LABEL}. ${settings.installationNote}`;
  const INSTALL_TOTAL_DISCLAIMER = settings.installationDisclaimer;
  const requestKey = useRef<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { user, ready: authReady } = useAuth();
  const { products, glues, getProduct, getGlueProduct } = useCatalog();

  const savedAddresses = user?.addresses ?? [];
  const defaultAddressId =
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? NEW_ADDRESS;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [editContact, setEditContact] = useState(false);
  const [addressId, setAddressId] = useState<string>(defaultAddressId);
  const [addressText, setAddressText] = useState("");
  const [note, setNote] = useState("");
  const [install, setInstall] = useState<"none" | "pro">("none");
  const [delivery, setDelivery] = useState(false);
  const [payment, setPayment] = useState("Хүргэлтээр төлөх");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill from the profile once auth resolves (fields load async on first paint).
  useEffect(() => {
    if (!user) return;
    setName((v) => v || user.name);
    setPhone((v) => v || user.phone);
    setEmail((v) => v || user.email || "");
    setAddressId((v) =>
      v === NEW_ADDRESS && defaultAddressId !== NEW_ADDRESS ? defaultAddressId : v,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selectedSaved =
    addressId === NEW_ADDRESS ? undefined : savedAddresses.find((a) => a.id === addressId);
  const address = selectedSaved ? formatAddress(selectedSaved) : addressText.trim();

  const installSelected = install === "pro";
  // Installation makes delivery free; a paid delivery only applies without it.
  const paidDelivery = !installSelected && delivery;
  const totals = computeTotals(items, products, paidDelivery, glues, settings.deliveryPrice);

  const deliveryLabel = installSelected
    ? "Үнэгүй — суурилуулалтын баг авч очно"
    : delivery
      ? `Хүргэлт — ${mnt(DELIVERY_PRICE)}`
      : "Өөрөө ирж авах — 0₮";

  if (!authReady) return <Loading />;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold">Захиалга өгөхийн өмнө нэвтэрнэ үү</h1>
        <AuthPanel onDone={() => {}} />
      </div>
    );
  if (cartError) return <DataError error={cartError} retry={syncCart} />;
  if (!ready) return <Loading />;

  if (ready && items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold">Сагс хоосон байна</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Захиалга үүсгэхийн тулд бүтээгдэхүүн сонгоно уу.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex h-13 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-foreground"
        >
          Бүтээгдэхүүн үзэх
        </Link>
      </div>
    );
  }

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!name.trim()) e["name"] = "Нэрээ оруулна уу.";
      if (phone.replace(/\D/g, "").length < 8) e["phone"] = "8 оронтой утасны дугаар оруулна уу.";
      if (!address.trim()) e["address"] = "Хаягаа оруулна уу.";
      if ((e["name"] || e["phone"]) && user) setEditContact(true);
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const order = await placeOrder(
        {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address,
          note: note.trim(),
          items,
          delivery: installSelected ? true : delivery,
          payment,
          hasInstall: installSelected,
        },
        requestKey.current,
      );
      await navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (e) {
      setSubmitError(errorMessage(e));
      // Network/server errors retain the key so retrying cannot create a duplicate.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) requestKey.current = "";
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel =
    step === 3
      ? "Захиалга баталгаажуулах"
      : step === 2
        ? "Төлбөр рүү үргэлжлүүлэх"
        : "Үргэлжлүүлэх";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 pb-16 sm:px-6 lg:mt-11 lg:mb-16 lg:px-8 lg:py-0 lg:pb-0">
      {/* Desktop: one centered floating workspace. Mobile: plain full-width flow. */}
      <div className="lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:px-10 lg:py-9 lg:shadow-soft">
        <h1 className="font-display text-2xl font-extrabold">Захиалга</h1>

        {submitError && (
          <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-4 text-destructive">
            {submitError}
          </p>
        )}
        <CheckoutSteps step={step} installSelected={installSelected} />

        <div className="mt-6 border-t border-border pt-7 lg:mt-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            {/* MAIN CONTENT */}
            <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
              {/* STEP 1 — Мэдээлэл */}
              {step === 0 && (
                <section className="space-y-6">
                  <div className="space-y-4">
                    <h2 className="font-display text-lg font-bold">Захиалагчийн мэдээлэл</h2>

                    {user && !editContact ? (
                      <div className="rounded-xl bg-accent/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium [overflow-wrap:anywhere]">{name}</p>
                            <p className="text-sm text-muted-foreground tabular-nums">{phone}</p>
                            {email && (
                              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                {email}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditContact(true)}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Засах
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Профайлаас автоматаар бөглөгдсөн
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {!user && (
                          <p className="text-sm text-muted-foreground">
                            Мэдээллээ нэг л удаа оруулна. Утасны дугаар нь таны захиалгын үндсэн
                            таних тэмдэг болно.
                          </p>
                        )}
                        <Field label="Нэр" error={errors["name"]}>
                          <TextInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Батбаяр"
                          />
                        </Field>
                        <Field label="Утасны дугаар" error={errors["phone"]}>
                          <TextInput
                            inputMode="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="9911-2233"
                          />
                        </Field>
                        {user && (
                          <Field label="Имэйл" hint="Заавал биш">
                            <TextInput
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@mail.com"
                            />
                          </Field>
                        )}
                        {user && (
                          <button
                            type="button"
                            onClick={() => setEditContact(false)}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                          >
                            Болих
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Address — only asked when there is no saved address, or the user adds one */}
                  <div className="space-y-3 border-t border-border pt-6">
                    <h3 className="font-display text-base font-bold">Хүргэх / суурилуулах хаяг</h3>
                    {savedAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {savedAddresses.map((a) => (
                          <label
                            key={a.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                              addressId === a.id
                                ? "border-accent bg-accent/5"
                                : "border-border hover:bg-secondary/40",
                            )}
                          >
                            <input
                              type="radio"
                              name="checkout-address"
                              checked={addressId === a.id}
                              onChange={() => setAddressId(a.id)}
                              className="mt-1 h-4 w-4 accent-[var(--accent)]"
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{a.label}</span>
                              <span className="block text-muted-foreground [overflow-wrap:anywhere]">
                                {formatAddress(a)}
                              </span>
                            </span>
                          </label>
                        ))}
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                            addressId === NEW_ADDRESS
                              ? "border-accent bg-accent/5"
                              : "border-border hover:bg-secondary/40",
                          )}
                        >
                          <input
                            type="radio"
                            name="checkout-address"
                            checked={addressId === NEW_ADDRESS}
                            onChange={() => setAddressId(NEW_ADDRESS)}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          <span className="font-medium">Өөр хаяг оруулах</span>
                        </label>
                        {addressId === NEW_ADDRESS && (
                          <Field label="Шинэ хаяг" error={errors["address"]}>
                            <TextInput
                              value={addressText}
                              onChange={(e) => setAddressText(e.target.value)}
                              placeholder="Дүүрэг, хороо, байр, тоот"
                            />
                          </Field>
                        )}
                        <Link
                          to="/profile/addresses"
                          className="inline-block text-xs font-medium text-accent hover:underline"
                        >
                          Хаягуудаа удирдах →
                        </Link>
                      </div>
                    ) : (
                      <Field
                        label="Хаяг"
                        hint={user ? "Хүргэлт болон суурилуулалтад ашиглана" : undefined}
                        error={errors["address"]}
                      >
                        <TextInput
                          value={addressText}
                          onChange={(e) => setAddressText(e.target.value)}
                          placeholder="Дүүрэг, хороо, байр, тоот"
                        />
                      </Field>
                    )}
                  </div>

                  <div className="border-t border-border pt-6">
                    <Field label="Нэмэлт тайлбар" hint="Заавал биш">
                      <TextArea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Орцны код, дуудах цаг гэх мэт"
                      />
                    </Field>
                  </div>
                </section>
              )}

              {/* STEP 2 — Суурилуулалт */}
              {step === 1 && (
                <section className="space-y-4">
                  <h2 className="font-display text-lg font-bold">
                    Мэргэжлийн суурилуулалт авах уу?
                  </h2>
                  <div className="space-y-2.5">
                    <OptionCard
                      selected={install === "none"}
                      onSelect={() => setInstall("none")}
                      title="Суурилуулалтгүй"
                      description="Хивсийг өөрөө эсвэл өөрийн багаар суурилуулна."
                      price={0}
                    />
                    <OptionCard
                      selected={install === "pro"}
                      onSelect={() => setInstall("pro")}
                      icon={<Wrench className="h-4 w-4" />}
                      title="Мэргэжлийн суурилуулалт"
                      description="Манай ажилтан таны сонгосон хивсийг авч очин мэргэжлийн түвшинд суурилуулж өгнө."
                      priceLabel={INSTALL_PRICE_TBD}
                    />
                  </div>

                  {installSelected && (
                    <div className="space-y-3 rounded-xl bg-accent/10 p-4">
                      <p className="text-sm leading-relaxed">{INSTALL_PRICE_NOTE}</p>
                      <p className="flex items-center gap-2 text-sm font-semibold text-success">
                        <Check className="h-4 w-4" /> Хүргэлт үнэгүй болно
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Суурилуулалтын үнэ ({INSTALL_RATE_LABEL}) захиалгын нийт дүнд ороогүй болно.
                  </p>
                </section>
              )}

              {/* STEP 3 — Хүргэлт */}
              {step === 2 && (
                <section className="space-y-4">
                  <h2 className="font-display text-lg font-bold">Хүргэлт</h2>

                  {installSelected ? (
                    <div className="flex items-start gap-3 rounded-xl bg-success/10 p-4">
                      <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                      <div className="min-w-0">
                        <p className="font-medium text-success">Хүргэлт үнэгүй</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Суурилуулалтын баг бүтээгдэхүүнийг таны хаягт авч очно.
                        </p>
                        <p className="mt-2 text-sm [overflow-wrap:anywhere]">{address}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Бүтээгдэхүүнээ хэрхэн авах вэ?
                      </p>
                      <div className="space-y-2.5">
                        <OptionCard
                          selected={!delivery}
                          onSelect={() => setDelivery(false)}
                          title="Өөрөө ирж авах"
                          description="Сүхбаатар дүүрэг, 1-р хороо. Даваа–Бямба 10:00–19:00."
                          price={0}
                        />
                        <OptionCard
                          selected={delivery}
                          onSelect={() => setDelivery(true)}
                          icon={<Truck className="h-4 w-4" />}
                          title="Хүргэлтээр авах"
                          description="Улаанбаатар хотод 1-2 хоногт хүргэнэ."
                          price={DELIVERY_PRICE}
                        />
                      </div>
                      {delivery && (
                        <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                          <p className="text-xs text-muted-foreground">Хүргэх хаяг</p>
                          <p className="mt-0.5 [overflow-wrap:anywhere]">{address}</p>
                          <button
                            type="button"
                            onClick={() => setStep(0)}
                            className="mt-1 text-xs font-medium text-accent hover:underline"
                          >
                            Хаяг засах
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* STEP 4 — Төлбөр + Захиалгын дэлгэрэнгүй */}
              {step === 3 && (
                <>
                  <section className="space-y-4">
                    <h2 className="font-display text-lg font-bold">Төлбөрийн хэлбэр</h2>
                    <div className="space-y-2.5">
                      {payments
                        .filter(
                          (p) =>
                            p.id !== "Банкны шилжүүлэг" ||
                            (settings.bankAccount && settings.bankName && settings.bankOwner),
                        )
                        .map((p) => {
                          const active = payment === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPayment(p.id)}
                              aria-pressed={active}
                              className={cn(
                                "flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors",
                                active
                                  ? "border-accent bg-accent/[0.06]"
                                  : "border-border bg-card hover:bg-secondary/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
                                  active
                                    ? "bg-accent/10 text-accent"
                                    : "bg-secondary text-muted-foreground",
                                )}
                              >
                                <p.icon className="h-[18px] w-[18px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{p.id}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {p.desc}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                                  active
                                    ? "border-accent bg-accent text-accent-foreground"
                                    : "border-muted-foreground/40",
                                )}
                              >
                                {active && <Check className="h-3 w-3" />}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </section>

                  <section className="mt-6 space-y-5 border-t border-border pt-6">
                    <h2 className="font-display text-lg font-bold">Захиалгын дэлгэрэнгүй</h2>

                    <div className="space-y-3">
                      {items.map((item) => {
                        if (item.kind === "carpet") {
                          const p = getProduct(item.productSlug);
                          if (!p) return null;
                          const variant =
                            p.variants.find((v) => v.id === item.colorId) ?? p.variants[0];
                          return (
                            <div
                              key={item.id}
                              className="border-b border-border pb-3 last:border-0 last:pb-0"
                            >
                              <div className="flex items-baseline justify-between gap-4">
                                <p className="font-medium">{p.name}</p>
                                <p className="shrink-0 text-sm font-semibold tabular-nums">
                                  {mnt(itemTotal(item, products, glues))}
                                </p>
                              </div>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {variant ? `${variant.name} · ${variant.code} · ` : ""}
                                {m2(itemArea(item, products))} · {item.pieces} ширхэг
                              </p>
                            </div>
                          );
                        }
                        const g = getGlueProduct(item.glueSlug);
                        if (!g) return null;
                        return (
                          <div
                            key={item.id}
                            className="border-b border-border pb-3 last:border-0 last:pb-0"
                          >
                            <SummaryRow
                              label={`${g.name} · ${item.quantity} сав`}
                              value={mnt(itemTotal(item, products, glues))}
                              muted
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Суурилуулалт</p>
                        <p className="mt-1 text-sm">
                          {installSelected ? "Мэргэжлийн суурилуулалт" : "Суурилуулалтгүй"}
                        </p>
                        {installSelected && (
                          <p className="text-xs text-muted-foreground">
                            {INSTALL_RATE_LABEL} · Эцсийн үнэ тохирно
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Хүргэлт</p>
                        <p className="mt-1 text-sm [overflow-wrap:anywhere]">{deliveryLabel}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Захиалагч</p>
                        <p className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">{name}</p>
                        <p className="text-sm text-muted-foreground tabular-nums">{phone}</p>
                        {email && (
                          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {email}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Хаяг</p>
                        <p className="mt-1 text-sm [overflow-wrap:anywhere]">{address}</p>
                        {note.trim() && (
                          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {note.trim()}
                          </p>
                        )}
                      </div>
                    </div>

                    {installSelected && (
                      <p className="rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
                        {INSTALL_TOTAL_DISCLAIMER}
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* ORDER SUMMARY — sticky inside the checkout shell on desktop */}
            <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="rounded-xl bg-secondary/50 p-5 lg:sticky lg:top-24">
                <h2 className="font-display text-base font-bold">Захиалгын дүн</h2>
                <div className="mt-4">
                  <SummaryRow label="Бүтээгдэхүүн" value={mnt(totals.goods)} />
                  <SummaryRow label="Цавуу" value={mnt(totals.glue)} />
                  <SummaryRow
                    label="Хүргэлт"
                    value={paidDelivery ? mnt(totals.shipping) : "Үнэгүй"}
                  />
                  {installSelected && (
                    <SummaryRow label="Суурилуулалт" value={INSTALL_PRICE_TBD} muted />
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">Онлайнаар төлөх нийт</p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    {mnt(totals.total)}
                  </p>
                </div>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  {installSelected
                    ? INSTALL_TOTAL_DISCLAIMER
                    : "Нэмэлт төлбөр байхгүй. Бүх үнэ НӨАТ багтсан."}
                </p>
              </div>
            </aside>

            {/* FOOTER ACTIONS */}
            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-start-1 lg:row-start-2">
              {step > 0 ? (
                <Btn
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep((s) => s - 1)}
                  className="w-full sm:w-auto"
                >
                  Буцах
                </Btn>
              ) : (
                <span className="hidden sm:block" />
              )}
              {step < 3 ? (
                <Btn size="lg" onClick={next} className="w-full sm:w-auto sm:min-w-[220px]">
                  {ctaLabel}
                </Btn>
              ) : (
                <Btn
                  size="lg"
                  onClick={submit}
                  disabled={submitting}
                  className="w-full sm:w-auto sm:min-w-[220px]"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {ctaLabel}
                </Btn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
