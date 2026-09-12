import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Ruler, Wrench } from "lucide-react";
import detailInstall from "@/assets/detail-install.jpg";
import heroRoom from "@/assets/hero-room.jpg";
import roomOffice from "@/assets/room-office.jpg";
import { useSettings, installationRate } from "@/lib/settings";
import { ContentBlocks } from "@/components/content-blocks";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/lib/catalog-store";
import { mnt } from "@/lib/format";
import { variantPrice, variantThickness } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JINTEMO — Японы модуль хивс, суурилуулалт | Улаанбаатар" },
      {
        name: "description",
        content:
          "Японоос импортолсон модуль хивс (carpet tile). Хэрэгцээт талбайгаа тооцоолж, өрөөндөө урьдчилж үзээд хүргэлт, суурилуулалттай захиалаарай.",
      },
      { property: "og:title", content: "JINTEMO — Японы модуль хивс" },
      {
        property: "og:description",
        content:
          "Өрөөгөө өөрийн хэв маягаар бүтээ. Японы чанартай модуль хивс, суурилуулалтын үйлчилгээ.",
      },
    ],
  }),
  component: Home,
});

function SectionHeading({ children, linkLabel }: { children: React.ReactNode; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-5">
      <h2 className="max-w-2xl font-display text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
        {children}
      </h2>
      <Link
        to="/products"
        className="hidden shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-accent sm:inline-flex"
      >
        {linkLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Home() {
  const { products, sections } = useCatalog();
  const { settings } = useSettings();
  const availableProducts = products.filter((product) => product.variants.length > 0);
  const featured = [...availableProducts].sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  const heroProduct = featured[0];
  const heroVariant = heroProduct?.variants[0];
  const collections = [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      section,
      product: availableProducts.find((product) => product.sectionId === section.id),
    }))
    .filter((collection) => collection.product);

  return (
    <div className="overflow-x-clip">
      {/* One complete image composition. The fixed homepage header lives outside this clipping context. */}
      <section className="px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="relative mx-auto min-h-[640px] max-w-[1440px] overflow-hidden rounded-[20px] bg-surface sm:min-h-[680px] lg:h-[700px] lg:min-h-0">
          <img
            src={settings.heroImage}
            alt="Японы загварын зочны өрөөнд суурилуулсан модуль хивс"
            width={1600}
            height={1104}
            className="absolute inset-0 h-full w-full object-cover object-[54%_center] sm:object-center"
          />
          <div className="hero-image-shade absolute inset-0" />

          <div className="relative z-10 flex min-h-[640px] items-end px-5 pb-7 pt-28 sm:min-h-[680px] sm:px-10 sm:pb-10 lg:h-[700px] lg:min-h-0 lg:px-14 lg:pb-14">
            <div className="max-w-[580px] text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/78 sm:text-sm">
                {settings.heroEyebrow}
              </p>
              <h1 className="mt-4 whitespace-pre-line font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[46px] lg:text-[52px]">
                {settings.heroTitle}
              </h1>
              <p className="mt-4 max-w-[500px] text-base leading-7 text-white/88">
                {settings.heroDescription}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/products"
                  search={{ category: "carpet" }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-card px-6 text-base font-semibold text-card-foreground transition-colors hover:bg-card/90"
                >
                  {settings.heroButton} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/visualizer"
                  className="inline-flex h-12 items-center justify-center rounded-md border border-white/45 bg-foreground/20 px-6 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-foreground/35"
                >
                  {settings.heroSecondaryButton}
                </Link>
              </div>
            </div>

            {heroProduct && heroVariant && (
              <Link
                to="/products/$slug"
                params={{ slug: heroProduct.slug }}
                search={{ color: heroVariant.id }}
                className="group absolute bottom-12 right-12 hidden w-[264px] gap-3 rounded-lg border border-white/55 bg-card/93 p-3 text-card-foreground shadow-soft backdrop-blur-xl transition-transform hover:-translate-y-0.5 lg:flex"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface">
                  <img
                    src={heroVariant.image}
                    alt={`${heroProduct.name} — ${heroVariant.name}`}
                    width={900}
                    height={900}
                    className="h-full w-full object-contain p-1.5"
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="line-clamp-2 font-display text-sm font-bold leading-tight">
                    {heroProduct.name}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {heroProduct.tileSize * 100}×{heroProduct.tileSize * 100} см ·{" "}
                    {variantThickness(heroProduct, heroVariant)}
                  </span>
                  <span className="mt-1.5 text-sm font-bold">
                    {mnt(variantPrice(heroProduct, heroVariant))}
                    <span className="font-medium text-muted-foreground"> / ширхэг</span>
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                    Дэлгэрэнгүй{" "}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <ContentBlocks />
      {/* Categories and real admin-managed collections */}
      <section className="container-page pt-16 sm:pt-20">
        <SectionHeading linkLabel="Бүх бүтээгдэхүүн">{settings.categoryTitle}</SectionHeading>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Link
            to="/products"
            search={{ category: "carpet" }}
            className="group relative h-[230px] overflow-hidden rounded-md bg-surface sm:h-[250px]"
          >
            <img
              src={settings.carpetImage}
              alt="Модуль хивсний сонголтууд"
              loading="lazy"
              width={1200}
              height={900}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
            />
            <div className="category-image-shade absolute inset-0" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 p-6 text-white sm:p-8">
              <span className="font-display text-2xl font-bold">{settings.carpetLabel}</span>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-foreground/30 backdrop-blur-sm transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5" />
              </span>
            </span>
          </Link>

          <Link
            to="/products"
            search={{ category: "glue" }}
            className="group relative h-[230px] overflow-hidden rounded-md bg-surface sm:h-[250px]"
          >
            <img
              src={settings.glueImage}
              alt="Модуль хивсний суурилуулалтын цавуу"
              loading="lazy"
              width={1200}
              height={900}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
            />
            <div className="category-image-shade absolute inset-0" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 p-6 text-white sm:p-8">
              <span className="font-display text-2xl font-bold">{settings.glueLabel}</span>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-foreground/30 backdrop-blur-sm transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5" />
              </span>
            </span>
          </Link>
        </div>

        {settings.showCollections && collections.length > 0 && (
          <div className="mt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {settings.collectionsTitle}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.slice(0, 4).map(({ section, product }) => {
                const variant = product!.variants[0]!;
                return (
                  <Link
                    key={section.id}
                    to="/products"
                    search={{ category: "carpet", section: section.id }}
                    className="group overflow-hidden rounded-md border border-border/80 bg-card"
                  >
                    <span className="grid aspect-[4/3] place-items-center overflow-hidden bg-surface">
                      <img
                        src={variant.image}
                        alt={`${section.name} цуглуулга`}
                        loading="lazy"
                        width={900}
                        height={900}
                        className="h-full w-full object-contain p-8 transition-transform duration-500 group-hover:scale-[1.035]"
                      />
                    </span>
                    <span className="flex items-center justify-between gap-3 px-5 py-4 font-display text-base font-bold">
                      {section.name}
                      <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent sm:hidden"
        >
          Бүх бүтээгдэхүүн <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Featured carpets */}
      <section hidden={!settings.showFeatured} className="container-page pt-16 sm:pt-20">
        <div className="mx-auto max-w-[1080px]">
          <SectionHeading linkLabel="Бүх хивс үзэх">{settings.featuredTitle}</SectionHeading>
          <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 lg:gap-y-12">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} appearance="editorial" />
            ))}
          </div>
          <Link
            to="/products"
            search={{ category: "carpet" }}
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent sm:hidden"
          >
            Бүх хивс үзэх <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Room preview */}
      <section hidden={!settings.showPreview} className="px-3 pt-16 sm:px-6 sm:pt-20">
        <div className="relative mx-auto min-h-[540px] max-w-[1440px] overflow-hidden rounded-[18px] bg-surface sm:min-h-[610px]">
          <img
            src={settings.previewImage}
            alt="Модуль хивстэй өрөөг урьдчилан харах"
            loading="lazy"
            width={1200}
            height={900}
            className="absolute inset-0 h-full w-full object-cover object-[58%_center] sm:object-center"
          />
          <div className="editorial-image-shade absolute inset-0" />
          <div className="relative z-10 flex min-h-[540px] items-end px-6 py-8 sm:min-h-[610px] sm:px-12 sm:py-12">
            <div className="max-w-[650px] text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                {settings.previewEyebrow}
              </p>
              <h2 className="mt-4 font-display text-[32px] font-extrabold leading-[1.12] tracking-[-0.03em] sm:text-5xl">
                {settings.previewTitle}
              </h2>
              <p className="mt-4 max-w-[570px] text-base leading-7 text-white/85 sm:text-lg">
                {settings.previewDescription}
              </p>
              <Link
                to="/visualizer"
                className="mt-7 inline-flex h-[52px] items-center justify-center gap-2 rounded-md bg-accent px-7 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
              >
                {settings.previewButton} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Installation information only — no form and no online estimate. */}
      <section
        hidden={!settings.showInstallation}
        id="installation"
        className="container-page scroll-mt-20 pb-10 pt-16 sm:pb-12 sm:pt-20"
      >
        <div className="grid gap-8 border-y border-border py-10 sm:py-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
              <Wrench className="h-5 w-5" />
            </span>
            <h2 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
              {settings.installationTitle}
            </h2>
          </div>
          <div className="max-w-3xl">
            <p className="text-base leading-7 text-foreground sm:text-lg sm:leading-8">
              {settings.installationBody}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md bg-surface p-5">
                <Ruler className="h-5 w-5 text-accent" />
                <p className="mt-3 font-display text-xl font-bold">{installationRate(settings)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {settings.installationNote}
                </p>
              </div>
              <div className="rounded-md bg-accent/7 p-5">
                <Check className="h-5 w-5 text-accent" />
                <p className="mt-3 font-semibold">{settings.installationSeparateTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {settings.installationDisclaimer}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
