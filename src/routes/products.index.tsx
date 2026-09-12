import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GitCompare, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { GlueCard } from "@/components/glue-card";
import { ProductCard } from "@/components/product-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Btn, EmptyState } from "@/components/ui-kit";
import { useCatalog } from "@/lib/catalog-store";
import {
  productInStock,
  variantInStock,
  variantPrice,
  variantThickness,
  type GlueProduct,
  type Product,
} from "@/lib/products";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type Category = "all" | "carpet" | "glue";
type Availability = "all" | "available" | "sold-out";
type Sort = "new" | "asc" | "desc" | "pop";

type Search = {
  room?: string | undefined;
  section?: string | undefined;
  sections?: string | undefined;
  category?: Category | undefined;
  q?: string | undefined;
  availability?: Availability | undefined;
  sale?: boolean | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  colors?: string | undefined;
  thicknesses?: string | undefined;
  sizes?: string | undefined;
  materials?: string | undefined;
  glueTypes?: string | undefined;
  coverages?: string | undefined;
  sort?: Sort | undefined;
};

type CarpetResult = { kind: "carpet"; product: Product; initialVariantId: string };
type GlueResult = { kind: "glue"; product: GlueProduct };
type Result = CarpetResult | GlueResult;

const sortOptions: { id: Sort; label: string }[] = [
  { id: "new", label: "Шинээр нэмэгдсэн" },
  { id: "asc", label: "Үнэ: өсөх" },
  { id: "desc", label: "Үнэ: буурах" },
  { id: "pop", label: "Эрэлттэй" },
];

function parseList(value?: string) {
  return value ? value.split(",").filter(Boolean) : [];
}

function numberSearchValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function listSearchValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function FilterChoice({
  selected,
  onSelect,
  label,
  count,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring/30",
        selected && "bg-accent/[0.07] font-semibold text-accent",
      )}
    >
      <span className="flex-1">{label}</span>
      {typeof count === "number" && (
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function FilterCheck({
  checked,
  onChange,
  label,
  swatch,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  swatch?: string;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-secondary/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {swatch && (
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: swatch }}
        />
      )}
      <span>{label}</span>
    </label>
  );
}

export const Route = createFileRoute("/products/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    room: listSearchValue(search["room"]),
    section: listSearchValue(search["section"]),
    sections: listSearchValue(search["sections"]),
    category:
      search["category"] === "carpet" ||
      search["category"] === "glue" ||
      search["category"] === "all"
        ? (search["category"] as Category)
        : undefined,
    q: listSearchValue(search["q"]),
    availability:
      search["availability"] === "available" || search["availability"] === "sold-out"
        ? (search["availability"] as Availability)
        : undefined,
    sale: search["sale"] === true || search["sale"] === "true" ? true : undefined,
    minPrice: numberSearchValue(search["minPrice"]),
    maxPrice: numberSearchValue(search["maxPrice"]),
    colors: listSearchValue(search["colors"]),
    thicknesses: listSearchValue(search["thicknesses"]),
    sizes: listSearchValue(search["sizes"]),
    materials: listSearchValue(search["materials"]),
    glueTypes: listSearchValue(search["glueTypes"]),
    coverages: listSearchValue(search["coverages"]),
    sort:
      search["sort"] === "asc" || search["sort"] === "desc" || search["sort"] === "pop"
        ? (search["sort"] as Sort)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Бүтээгдэхүүн — Хивс, цавуу | JINTEMO" },
      {
        name: "description",
        content:
          "Японы модуль хивс болон суурилуулалтын цавуугаа өнгө, загвар, үнэ, төрлөөр шүүж сонгоно уу.",
      },
      { property: "og:title", content: "Бүтээгдэхүүн — JINTEMO" },
      { property: "og:description", content: "Хивс болон цавууны бүтээгдэхүүний каталог." },
    ],
  }),
  component: ProductList,
});

function ProductList() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { products: catalogProducts, sections, glues: glueProducts } = useCatalog();
  const { compareIds, openCompareView } = useUi();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const products = useMemo(
    () => catalogProducts.filter((product) => product.variants.length > 0),
    [catalogProducts],
  );
  const category = search.category ?? "all";
  const availability = search.availability ?? "all";
  const sort = search.sort ?? "new";
  const query = (search.q ?? "").trim().toLowerCase();
  const selectedColors = parseList(search.colors);
  const selectedThicknesses = parseList(search.thicknesses);
  const selectedSizes = parseList(search.sizes);
  const selectedMaterials = parseList(search.materials);
  const selectedSections = parseList(search.sections ?? search.section);
  const selectedGlueTypes = parseList(search.glueTypes);
  const selectedCoverages = parseList(search.coverages);

  const updateSearch = (patch: Partial<Search>) => {
    navigate({ to: "/products", search: { ...search, ...patch }, replace: true });
  };

  const toggleList = (key: keyof Search, current: string[], value: string) => {
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateSearch({
      [key]: next.length ? next.join(",") : undefined,
      ...(key === "sections" ? { section: undefined } : {}),
    });
  };

  const allColors = useMemo(() => {
    const colors = new Map<string, { id: string; name: string; hex: string }>();
    for (const product of products) {
      for (const variant of product.variants) {
        if (!colors.has(variant.id)) {
          colors.set(variant.id, { id: variant.id, name: variant.name, hex: variant.hex });
        }
      }
    }
    return [...colors.values()];
  }, [products]);

  const thicknessOptions = useMemo(
    () =>
      [...new Set(products.flatMap((p) => p.variants.map((v) => variantThickness(p, v))))].sort(
        (a, b) => parseFloat(a) - parseFloat(b),
      ),
    [products],
  );
  const sizeOptions = useMemo(
    () => [...new Set(products.map((p) => `${p.tileSize * 100}×${p.tileSize * 100} см`))],
    [products],
  );
  const materialOptions = useMemo(() => [...new Set(products.map((p) => p.material))], [products]);
  const glueTypeOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const glue of glueProducts) values.set(glue.glueType, glue.glueTypeLabel);
    return [...values.entries()].map(([id, label]) => ({ id, label }));
  }, [glueProducts]);
  const coverageOptions = useMemo(
    () =>
      [...new Set(glueProducts.map((glue) => String(glue.coverage)))].sort(
        (a, b) => Number(a) - Number(b),
      ),
    [glueProducts],
  );

  const filteredCarpets = useMemo<CarpetResult[]>(() => {
    return products.flatMap((product) => {
      if (
        query &&
        !product.name.toLowerCase().includes(query) &&
        !product.short.toLowerCase().includes(query)
      ) {
        return [];
      }
      if (search.room && !product.rooms.includes(search.room) && product.style !== search.room) {
        return [];
      }
      if (selectedSections.length && !selectedSections.includes(product.sectionId)) return [];
      if (
        selectedSizes.length &&
        !selectedSizes.includes(`${product.tileSize * 100}×${product.tileSize * 100} см`)
      ) {
        return [];
      }
      if (selectedMaterials.length && !selectedMaterials.includes(product.material)) return [];

      const matchingVariants = product.variants.filter((variant) => {
        if (selectedColors.length && !selectedColors.includes(variant.id)) return false;
        if (
          selectedThicknesses.length &&
          !selectedThicknesses.includes(variantThickness(product, variant))
        ) {
          return false;
        }
        const price = variantPrice(product, variant);
        if (typeof search.minPrice === "number" && price < search.minPrice) return false;
        if (typeof search.maxPrice === "number" && price > search.maxPrice) return false;
        return true;
      });
      if (!matchingVariants.length) return [];

      const variantScoped =
        selectedColors.length > 0 ||
        selectedThicknesses.length > 0 ||
        typeof search.minPrice === "number" ||
        typeof search.maxPrice === "number";
      if (availability === "available") {
        if (variantScoped && !matchingVariants.some(variantInStock)) return [];
        if (!variantScoped && !productInStock(product)) return [];
      }
      if (availability === "sold-out") {
        if (variantScoped && !matchingVariants.some((variant) => !variantInStock(variant)))
          return [];
        if (!variantScoped && productInStock(product)) return [];
      }

      if (
        search.sale &&
        !matchingVariants.some(
          (variant) =>
            typeof product.oldPrice === "number" &&
            product.oldPrice > variantPrice(product, variant),
        )
      ) {
        return [];
      }

      const preferredVariants =
        availability === "available"
          ? matchingVariants.filter(variantInStock)
          : availability === "sold-out"
            ? matchingVariants.filter((variant) => !variantInStock(variant))
            : matchingVariants;

      return [
        {
          kind: "carpet" as const,
          product,
          initialVariantId: (preferredVariants[0] ?? matchingVariants[0]!).id,
        },
      ];
    });
  }, [
    products,
    query,
    search.room,
    search.minPrice,
    search.maxPrice,
    search.sale,
    selectedSections,
    selectedSizes,
    selectedMaterials,
    selectedColors,
    selectedThicknesses,
    availability,
  ]);

  const filteredGlue = useMemo<GlueResult[]>(() => {
    return glueProducts.flatMap((product) => {
      if (
        query &&
        !product.name.toLowerCase().includes(query) &&
        !product.short.toLowerCase().includes(query)
      ) {
        return [];
      }
      if (selectedGlueTypes.length && !selectedGlueTypes.includes(product.glueType)) return [];
      if (selectedCoverages.length && !selectedCoverages.includes(String(product.coverage)))
        return [];
      if (typeof search.minPrice === "number" && product.price < search.minPrice) return [];
      if (typeof search.maxPrice === "number" && product.price > search.maxPrice) return [];
      if (availability === "available" && !product.inStock) return [];
      if (availability === "sold-out" && product.inStock) return [];
      if (search.sale) return [];
      return [{ kind: "glue" as const, product }];
    });
  }, [
    glueProducts,
    query,
    selectedGlueTypes,
    selectedCoverages,
    search.minPrice,
    search.maxPrice,
    search.sale,
    availability,
  ]);

  const visibleResults = useMemo(() => {
    const entries: Result[] =
      category === "carpet"
        ? filteredCarpets
        : category === "glue"
          ? filteredGlue
          : [...filteredCarpets, ...filteredGlue];

    return [...entries].sort((a, b) => {
      const priceA =
        a.kind === "carpet"
          ? variantPrice(
              a.product,
              a.product.variants.find((v) => v.id === a.initialVariantId)!,
            )
          : a.product.price;
      const priceB =
        b.kind === "carpet"
          ? variantPrice(
              b.product,
              b.product.variants.find((v) => v.id === b.initialVariantId)!,
            )
          : b.product.price;
      if (sort === "asc") return priceA - priceB;
      if (sort === "desc") return priceB - priceA;
      if (sort === "pop") return b.product.popularity - a.product.popularity;
      return b.product.createdAt.localeCompare(a.product.createdAt);
    });
  }, [category, filteredCarpets, filteredGlue, sort]);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (availability !== "all" ? 1 : 0) +
    (search.sale ? 1 : 0) +
    (typeof search.minPrice === "number" ? 1 : 0) +
    (typeof search.maxPrice === "number" ? 1 : 0) +
    selectedColors.length +
    selectedThicknesses.length +
    selectedSizes.length +
    selectedMaterials.length +
    selectedSections.length +
    selectedGlueTypes.length +
    selectedCoverages.length +
    (search.room ? 1 : 0);

  const clearFilters = () => {
    navigate({ to: "/products", search: { q: search.q, sort: search.sort }, replace: true });
  };

  const categoryPrices =
    category === "carpet"
      ? products.flatMap((p) => p.variants.map((v) => variantPrice(p, v)))
      : category === "glue"
        ? glueProducts.map((g) => g.price)
        : [
            ...products.flatMap((p) => p.variants.map((v) => variantPrice(p, v))),
            ...glueProducts.map((g) => g.price),
          ];
  const priceFloor = Math.min(...(categoryPrices.length ? categoryPrices : [0]));
  const priceCeiling = Math.max(...(categoryPrices.length ? categoryPrices : [0]));
  const priceUnit = category === "carpet" ? "₮ / ширхэг" : category === "glue" ? "₮ / сав" : "₮";

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (category !== "all") {
    chips.push({
      key: "category",
      label: category === "carpet" ? "Хивс" : "Цавуу",
      remove: () => updateSearch({ category: "all" }),
    });
  }
  if (availability !== "all") {
    chips.push({
      key: "availability",
      label: availability === "available" ? "Бэлэн байгаа" : "Дууссан",
      remove: () => updateSearch({ availability: undefined }),
    });
  }
  if (search.sale) {
    chips.push({
      key: "sale",
      label: "Хямдралтай",
      remove: () => updateSearch({ sale: undefined }),
    });
  }
  if (search.room) {
    chips.push({
      key: "room",
      label: search.room,
      remove: () => updateSearch({ room: undefined }),
    });
  }
  if (typeof search.minPrice === "number") {
    chips.push({
      key: "minPrice",
      label: `${search.minPrice.toLocaleString()}₮-с`,
      remove: () => updateSearch({ minPrice: undefined }),
    });
  }
  if (typeof search.maxPrice === "number") {
    chips.push({
      key: "maxPrice",
      label: `${search.maxPrice.toLocaleString()}₮ хүртэл`,
      remove: () => updateSearch({ maxPrice: undefined }),
    });
  }
  for (const id of selectedColors) {
    chips.push({
      key: `color-${id}`,
      label: allColors.find((color) => color.id === id)?.name ?? id,
      remove: () => toggleList("colors", selectedColors, id),
    });
  }
  for (const value of selectedThicknesses) {
    chips.push({
      key: `thickness-${value}`,
      label: value,
      remove: () => toggleList("thicknesses", selectedThicknesses, value),
    });
  }
  for (const value of selectedSizes) {
    chips.push({
      key: `size-${value}`,
      label: value,
      remove: () => toggleList("sizes", selectedSizes, value),
    });
  }
  for (const value of selectedMaterials) {
    chips.push({
      key: `material-${value}`,
      label: value,
      remove: () => toggleList("materials", selectedMaterials, value),
    });
  }
  for (const id of selectedSections) {
    chips.push({
      key: `section-${id}`,
      label: sections.find((section) => section.id === id)?.name ?? id,
      remove: () => toggleList("sections", selectedSections, id),
    });
  }
  for (const id of selectedGlueTypes) {
    chips.push({
      key: `glue-${id}`,
      label: glueTypeOptions.find((type) => type.id === id)?.label ?? id,
      remove: () => toggleList("glueTypes", selectedGlueTypes, id),
    });
  }
  for (const value of selectedCoverages) {
    chips.push({
      key: `coverage-${value}`,
      label: `${value} m² / сав`,
      remove: () => toggleList("coverages", selectedCoverages, value),
    });
  }

  const FilterPanel = ({ showHeading = true }: { showHeading?: boolean }) => (
    <div>
      {showHeading && (
        <div className="flex h-10 items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Шүүлтүүр</h2>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Цэвэрлэх
            </button>
          )}
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={["category", "availability", "sale"]}
        className={cn(showHeading && "mt-2 border-t border-border")}
      >
        <AccordionItem value="category">
          <AccordionTrigger className="hover:no-underline">Ангилал</AccordionTrigger>
          <AccordionContent className="space-y-1">
            <FilterChoice
              selected={category === "all"}
              onSelect={() => updateSearch({ category: "all" })}
              label="Бүх бүтээгдэхүүн"
              count={filteredCarpets.length + filteredGlue.length}
            />
            <FilterChoice
              selected={category === "carpet"}
              onSelect={() => updateSearch({ category: "carpet" })}
              label="Хивс"
              count={filteredCarpets.length}
            />
            <FilterChoice
              selected={category === "glue"}
              onSelect={() => updateSearch({ category: "glue" })}
              label="Цавуу"
              count={filteredGlue.length}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="availability">
          <AccordionTrigger className="hover:no-underline">Бэлэн байдал</AccordionTrigger>
          <AccordionContent className="space-y-1">
            {(
              [
                ["all", "Бүгд"],
                ["available", "Бэлэн байгаа"],
                ["sold-out", "Дууссан"],
              ] as const
            ).map(([value, label]) => (
              <FilterChoice
                key={value}
                selected={availability === value}
                onSelect={() => updateSearch({ availability: value === "all" ? undefined : value })}
                label={label}
              />
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sale">
          <AccordionTrigger className="hover:no-underline">Хямдрал</AccordionTrigger>
          <AccordionContent>
            <FilterCheck
              checked={Boolean(search.sale)}
              onChange={() => updateSearch({ sale: search.sale ? undefined : true })}
              label="Зөвхөн хямдралтай"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger className="hover:no-underline">Үнэ</AccordionTrigger>
          <AccordionContent>
            <p className="mb-2 text-xs text-muted-foreground">{priceUnit}</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="sr-only">Доод үнэ</span>
                <input
                  type="number"
                  min={0}
                  value={search.minPrice ?? ""}
                  placeholder={priceFloor.toLocaleString()}
                  onChange={(event) =>
                    updateSearch({
                      minPrice: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
              <label>
                <span className="sr-only">Дээд үнэ</span>
                <input
                  type="number"
                  min={0}
                  value={search.maxPrice ?? ""}
                  placeholder={priceCeiling.toLocaleString()}
                  onChange={(event) =>
                    updateSearch({
                      maxPrice: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </div>
          </AccordionContent>
        </AccordionItem>

        {category === "carpet" && (
          <>
            <AccordionItem value="color">
              <AccordionTrigger className="hover:no-underline">Өнгө</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {allColors.map((color) => (
                  <FilterCheck
                    key={color.id}
                    checked={selectedColors.includes(color.id)}
                    onChange={() => toggleList("colors", selectedColors, color.id)}
                    label={color.name}
                    swatch={color.hex}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="thickness">
              <AccordionTrigger className="hover:no-underline">Зузаан</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {thicknessOptions.map((value) => (
                  <FilterCheck
                    key={value}
                    checked={selectedThicknesses.includes(value)}
                    onChange={() => toggleList("thicknesses", selectedThicknesses, value)}
                    label={value}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="size">
              <AccordionTrigger className="hover:no-underline">Хэмжээ</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {sizeOptions.map((value) => (
                  <FilterCheck
                    key={value}
                    checked={selectedSizes.includes(value)}
                    onChange={() => toggleList("sizes", selectedSizes, value)}
                    label={value}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="material">
              <AccordionTrigger className="hover:no-underline">Материал</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {materialOptions.map((value) => (
                  <FilterCheck
                    key={value}
                    checked={selectedMaterials.includes(value)}
                    onChange={() => toggleList("materials", selectedMaterials, value)}
                    label={value}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="section">
              <AccordionTrigger className="hover:no-underline">Цуврал</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {[...sections]
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <FilterCheck
                      key={section.id}
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleList("sections", selectedSections, section.id)}
                      label={section.name}
                    />
                  ))}
              </AccordionContent>
            </AccordionItem>
          </>
        )}

        {category === "glue" && (
          <>
            <AccordionItem value="glue-type">
              <AccordionTrigger className="hover:no-underline">Цавууны төрөл</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {glueTypeOptions.map((type) => (
                  <FilterCheck
                    key={type.id}
                    checked={selectedGlueTypes.includes(type.id)}
                    onChange={() => toggleList("glueTypes", selectedGlueTypes, type.id)}
                    label={type.label}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="coverage">
              <AccordionTrigger className="hover:no-underline">Хамрах талбай</AccordionTrigger>
              <AccordionContent className="space-y-1">
                {coverageOptions.map((value) => (
                  <FilterCheck
                    key={value}
                    checked={selectedCoverages.includes(value)}
                    onChange={() => toggleList("coverages", selectedCoverages, value)}
                    label={`${value} m² / сав`}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </>
        )}
      </Accordion>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 md:px-8">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Бүтээгдэхүүн</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {query ? `“${search.q}” — хайлтын илэрц.` : "Японы модуль хивс, суурилуулалтын цавуу."}
      </p>

      <div className="mt-8 lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-7">
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-2 [scrollbar-width:thin]">
          <FilterPanel />
        </aside>

        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {visibleResults.length}
              </span>{" "}
              бүтээгдэхүүн
            </p>
            <div className="flex items-center gap-2">
              {compareIds.length > 0 && category !== "glue" && (
                <button
                  type="button"
                  onClick={openCompareView}
                  className="hidden h-10 items-center gap-1.5 rounded-md border border-accent/40 px-3 text-xs font-semibold text-accent sm:inline-flex"
                >
                  <GitCompare className="h-3.5 w-3.5" /> Харьцуулах ({compareIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" /> Шүүлтүүр
                {activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>
              <select
                value={sort}
                onChange={(event) => updateSearch({ sort: event.target.value as Sort })}
                className="h-10 max-w-[170px] rounded-md border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 sm:max-w-none sm:px-3"
                aria-label="Эрэмбэлэх"
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Сонгосон шүүлтүүрүүд">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground outline-none hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {chip.label} <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-5">
            {visibleResults.length === 0 ? (
              <EmptyState
                icon={X}
                title="Тохирох бүтээгдэхүүн олдсонгүй"
                description="Сонгосон шүүлтүүрүүдээ өөрчлөх эсвэл цэвэрлээд дахин оролдоно уу."
                action={
                  <Btn variant="secondary" onClick={clearFilters}>
                    Шүүлтүүр цэвэрлэх
                  </Btn>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
                {visibleResults.map((entry) =>
                  entry.kind === "carpet" ? (
                    <ProductCard
                      key={entry.product.slug}
                      product={entry.product}
                      initialVariantId={entry.initialVariantId}
                    />
                  ) : (
                    <GlueCard key={entry.product.slug} product={entry.product} />
                  ),
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh] lg:hidden">
          <DrawerHeader className="flex-row items-center justify-between border-b border-border pb-3 text-left">
            <DrawerTitle className="font-display">Шүүлтүүр</DrawerTitle>
            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 px-2 text-sm font-semibold text-accent"
                >
                  Цэвэрлэх
                </button>
              )}
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Хаах"
                  className="grid h-10 w-10 place-items-center rounded-md hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 pb-4">
            <FilterPanel showHeading={false} />
          </div>
          <DrawerFooter className="border-t border-border bg-card">
            <Btn className="w-full" onClick={() => setDrawerOpen(false)}>
              Үр дүн харах ({visibleResults.length})
            </Btn>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
