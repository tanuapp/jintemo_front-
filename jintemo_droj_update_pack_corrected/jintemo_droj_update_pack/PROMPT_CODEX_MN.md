# JINTEMO / DROJ - Codex засварын үндсэн prompt

## ЗӨВ PROJECT PATH-УУД

Өмнө ашигласан `D:\website\droj` path БУРУУ. Түүнийг ашиглахгүй. Энэ update нь тусдаа frontend + backend хоёр codebase дээр хийгдэнэ.

**Frontend:**
`C:\Users\Tanusoft\Desktop\droj\jintemo_front-`

Frontend-ийн үндсэн бүтэц:
- `.lovable/`
- `public/`
- `shared/`
- `src/`
- `.env.example`
- `AGENTS.md`
- `DEPLOYMENT.md`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `components.json`
- `jintemo-logo.jpg`

**Backend:**
`C:\Users\Tanusoft\Desktop\droj\jintemo_backend`

Backend-ийн үндсэн бүтэц:
- `api/`
- `config/`
- `cozy/`
- `fixtures/`
- `public/`
- `scripts/`
- `shared/`
- `test/`
- `.env`
- `.env.production.example`
- `app.js`
- `server.js`
- `package.json`
- `package-lock.json`
- `vercel.json`

**Эх шаардлагын DOCX:**
`C:\Users\Tanusoft\Desktop\droj\jintemo_front-\web zaswar hogjuuleltt.docx`

Энэ нь JINTEMO / japancarpet.mn вэбийн одоо байгаа frontend + backend төсөл. Одоогийн UI, route, admin, API, бүтээгдэхүүн, зураг, content, auth, persistence болон ажиллаж байгаа feature-үүдийг эвдэхгүй. Шинэ төсөл шинээр үүсгэхгүй. Frontend ба backend-ийг эхлээд хамтад нь бүрэн шалгаад одоо ашиглаж байгаа architecture дээр нь өөрчлөлт хийнэ. `jintemo_backend` бодит backend тул өөр duplicate backend, Supabase, local-only mock storage шинээр бүү үүсгэ. Frontend нь шинэ field/feature-үүдээ existing API contract-ийг зөв өргөтгөсөн backend endpoint-уудаар хадгалдаг байх ёстой.

## Ажил эхлэхийн өмнө

1. Frontend-ийн `package.json`, `src`, `shared`, admin route/page/component, product UI/model/type, API client/service, auth/role, public product listing-ийг шалга.
2. Backend-ийн `package.json`, `app.js`, `server.js`, `api`, `config`, `shared`, `scripts`, `fixtures`, `test`-ийг шалгаж product/category/inventory data model, persistence болон endpoint-уудыг яг хаана хэрэгжүүлснийг тодорхойл.
3. Frontend ямар API base URL/environment ашиглаж байгааг тогтоож, backend-ийн одоогийн route-тай тулгаж шалга.
4. Одоо бүтээгдэхүүний төрөл, үнэ, хэмжээ, үлдэгдэл хаана хадгалагдаж байгааг тодорхойл.
5. Existing schema/data-г устгахгүй, backward-compatible migration/update хийнэ.
6. `assets/reference/` доторх 8 reference screenshot болон дээрх DOCX-ийг шаардлагын визуал тайлбар гэж ашигла.
7. Хийсэн өөрчлөлт бүр нь backend persistence-д хадгалагдаж refresh/restart хийсний дараа хэвээр байх ёстой. Түр mock state/local-only state-аар дуусгаж болохгүй.
8. Frontend болон backend хоёр repo/folder дээр хийсэн өөрчлөлтийг тус тусад нь тайлагна.

---

# 1. Logo-г зөв голлуулах

Reference: `assets/reference/01_logo_centering_reference.png`

Public site дээр JINTEMO logo зураг байгаа container дотроо босоо, хэвтээ тэнхлэгээр зөв төвлөрсөн харагддаг болго.

Шаардлага:
- Logo crop/stretch хийхгүй.
- `object-fit: contain` логик хэрэглэ.
- Desktop/mobile аль алинд төвдөө байна.
- Existing header/banner-ийн өндөр, layout-ийг эвдэхгүй.
- `jintemo-logo.jpg` одоо ашиглагддаг бол түүнийг хэвээр ашигла; шинэ production logo зохиож/солихгүй.

---

# 2. Бүтээгдэхүүний төрлийг Admin өөрөө CRUD хийдэг болго

Reference:
- `assets/reference/02_public_product_types_reference.png`
- `assets/reference/03_admin_product_form_reference.png`

Одоогоор `Хивс`, `Цавуу` гэсэн хатуу төрлүүд байвал hardcode-ийг арилгаж, data-driven product type болго.

Admin дараах үйлдлийг хийж чадна:
- Шинэ бүтээгдэхүүний төрөл нэмэх
- Нэр өөрчлөх
- Идэвхтэй/идэвхгүй болгох эсвэл устгах
- Эрэмбэ өөрчлөх боломж existing architecture-д хялбар байвал нэмэх

Жишээ нэмэгдэх төрлүүд:
- Double side наалт
- Ам дарагч
- Хавтан хулдаас
- цаашид дурын шинэ төрөл

Data model-ийн зорилтот хэлбэр (existing architecture-д тааруулж нэршлийг өөрчилж болно):

```ts
type ProductType = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder?: number;
};
```

Product нь text type хадгалах биш боломжтой бол `typeId`/reference хадгалдаг болго. Existing legacy data-г эвдэхгүй migration хий.

Бүтээгдэхүүн нэмэх/засах форм дээр `Бүтээгдэхүүний төрөл` dropdown нь DB/store дахь active product types-оос dynamic уншина. Админ шинээр төрөл нэмсний дараа code өөрчлөхгүйгээр dropdown-д харагдана.

Public нүүр/бүтээгдэхүүний хэсэг дээр category/type-ууд мөн dynamic харагдана. `Хивс`, `Цавуу` гэсэн хоёр card л hardcoded байж болохгүй.

Устгах үед:
- Тухайн төрөлд бүтээгдэхүүн холбогдсон байвал orphan data үүсгэж болохгүй.
- Safe behavior: delete-г блоклох эсвэл өөр төрөл рүү шилжүүлэхийг шаардах.
- Silent data loss бүү хий.

---

# 3. Үнэ: ширхэгийн хатуу логикийг болиулж, нэгж сонгодог болго

Reference:
- `assets/reference/04_current_price_field_reference.png`
- `assets/reference/05_unit_selector_reference.png`

Одоогийн `Суурь үнэ (₮/ширхэг)` field-ийг generic үнэ + нэгжийн сонголт болгож өөрчил.

Нэгжийн сонголт:
- `м²`
- `ширхэг`
- `метр`

Suggested model:

```ts
type PriceUnit = 'm2' | 'piece' | 'meter';

price: number;
priceUnit: PriceUnit;
```

UI label mapping:
- `m2` -> `м²`
- `piece` -> `ширхэг`
- `meter` -> `метр`

Үнэ field дээр админ тоогоо шууд оруулна. Carpet/tile бүтээгдэхүүний үнийг 4-т автоматаар хувааж/үржүүлэхгүй. Хэрэглэгчийн оруулсан үнэ нь тухайн сонгосон нэгжийн үнэ гэж хадгалагдана.

Legacy migration:
- Existing `Хивс` бүтээгдэхүүнүүдийн одоогийн numeric price-г өөрчлөхгүй, default unit-ийг `м²` болго.
- Existing `Цавуу` бүтээгдэхүүнүүдийн numeric price-г өөрчлөхгүй, default unit-ийг `ширхэг` болго.
- Бусад/шинэ төрлүүд дээр admin өөрөө unit сонгоно.
- Хуучин үнэ data-г auto divide/multiply хийж гэмтээж болохгүй.

Public product card/detail дээр үнэ дараах хэлбэртэй харагдана:
- `88,000₮ / м²`
- `25,000₮ / ширхэг`
- `18,000₮ / метр`

---

# 4. Урт, өргөнийг тусдаа field болго

Reference: `assets/reference/06_dimensions_reference.png`

Дрож/хивс/хулдаас гэх мэт бараанд хэмжээ нэг format-аар хатуу байх ёсгүй.

Admin product form дээр:
- `Өргөн (м)`
- `Урт (м)`

гэсэн 2 тусдаа decimal number field нэм.

Дэмжих жишээ:
- 0.5 x 0.5
- 0.25 x 1
- 1.82 x 30

Suggested fields:

```ts
widthM?: number;
lengthM?: number;
```

Шаардлага:
- Decimal утга зөв хадгална.
- 0 эсвэл сөрөг хэмжээ validation-аар хаагдана.
- Бүх төрлийн бараанд хэмжээ заавал шаардахгүй; шаардлагагүй бүтээгдэхүүн дээр optional байж болно.
- Existing dimensions field байвал data-г алдахгүйгээр map/migrate хийнэ.
- UI дээр хэмжээ байгаа үед `0.5 × 0.5 м`, `1.82 × 30 м` гэх мэт ойлгомжтой харагдуул.

---

# 5. Үлдэгдэл / салбарын stock management-ийг тусдаа, inline-edit page болго

Reference:
- `assets/reference/07_product_inventory_table_reference.png`
- `assets/reference/08_admin_sidebar_inventory_menu_reference.png`

Энэ шаардлагад PAGE 5 дээр санал болгосон хувилбарыг хэрэгжүүл: одоо байгаа `Бүтээгдэхүүн` list болон түүний `Засах`, `Устгах` хэсгийг аль болох өөрчлөхгүй. Admin sidebar-д шинэ `Үлдэгдэл` menu/page нэм.

Анхны stock location/branch-ууд:
- Агуулах
- Мишээл салбар
- Одкон 2
- Одкон 3

Хэрэв codebase-д branch/location entity аль хэдийн байвал дээрхийг hardcode хийхгүй, тэр model/data-г ашигла. Хэрэв branch model байхгүй бол inventory data-г location-keyed байдлаар clean, өргөтгөх боломжтой бүтэцтэй хий.

Suggested model:

```ts
type InventoryByLocation = {
  [locationId: string]: number;
};

// product дотор эсвэл тусдаа inventory entity хэлбэрээр
inventoryByLocation: InventoryByLocation;
```

`Үлдэгдэл` page table:
- Бүтээгдэхүүний зураг/код/нэр
- Төрөл
- Агуулах
- Мишээл салбар
- Одкон 2
- Одкон 3
- Нийт үлдэгдэл

Inline edit behavior:
- Excel шиг cell дээр click хийхэд тоо edit хийдэг.
- Өөр page/modal руу орохгүй.
- Enter эсвэл save action-аар хадгална; blur autosave ашиглаж болох ч алдаа гарвал rollback + error message үзүүл.
- Refresh хийсний дараа утга хадгалагдсан байна.
- Зөвхөн >= 0 бүхэл/зөвшөөрөгдсөн тоо авна. Stock negative болох ёсгүй.
- `Нийт үлдэгдэл` = бүх салбарын нийлбэр, шууд update болно.
- Search/filter existing product list-тэй төстэй байвал reuse хий.

Role/auth existing system-д байгаа тохиолдолд:
- Admin бүх location-ийн үлдэгдлийг өөрчилж чадна.
- Branch-bound staff concept аль хэдийн байгаа бол өөрийн салбарын stock-ийг л өөрчлөх permission ашигла.
- Хэрэв project-д role/branch auth огт байхгүй бол шинэ auth system зохиож scope-ийг тэлэхгүй; data/UI-г зөв хийж, role restriction-ийн TODO-г тайландаа тусад нь дурд.

Optional боловч боломжтой бол stock update audit metadata хадгал:
- updatedAt
- updatedBy

---

# 6. Existing design ба behavior хамгаалах

Заавал хадгал:
- Одоогийн JINTEMO branding, өнгө, typography
- Existing routes
- Existing admin navigation (шинэ `Үлдэгдэл` menu-гээс бусад)
- Existing product edit/delete behavior
- Existing content/media functionality
- Mobile responsive behavior

Хийж болохгүй:
- Бүх UI-г шинээр redesign хийх
- Existing data reset хийх
- Product list delete/edit action-ийг алга болгох
- Hardcoded fake data-гаар дуусгах
- Existing API contract-ийг шаардлагагүйгээр эвдэх
- Separate duplicate backend/storage үүсгэх

---

# 7. Backward compatibility / migration

Existing data-г эвдэхгүй.

Шалгах зүйлс:
- `Хивс` / `Цавуу` product type values
- Existing price field naming
- Existing stock/quantity field
- Existing dimension/packaging fields
- Existing category/collection logic

Хэрэв schema migration шаардлагатай бол idempotent migration эсвэл safe startup normalization хий. Хуучин бүтээгдэхүүнүүд public/admin дээр алга болох ёсгүй.

Stock legacy migration-д одоогийн ганц `quantity/stock` утгыг яаж салбаруудад хуваарилах нь эх сурвалжаар тодорхойгүй. Тиймээс silent arbitrary split БҮҮ хий. Safe default:
- existing total stock-ийг `Агуулах` location-д оноож,
- бусад location-ийг 0 болго,
- migration note/report-д энэ шийдлийг тодорхой бич.

---

# 8. Validation ба UX

- Үнэ: negative утга хоригло.
- Өргөн/урт: <= 0 утга хоригло.
- Stock: negative хоригло.
- Product type name: хоосон, duplicate normalized name хоригло.
- Form errors Mongolian ойлгомжтой тексттэй байна.
- Save/loading/success/error states existing component library-ийн style-тай байна.
- Mobile admin table дээр horizontal scroll эсвэл responsive layout зөв ажиллана.

---

# 9. Build/test

Өөрчлөлт хийсний дараа:

1. Frontend болон backend тус бүрийн `package.json` + lockfile + existing project convention-ийг шалгаж зөв package manager/scripts ашигла; дур мэдэн lockfile сольж болохгүй.
2. Dependency шаардлагагүй бол шинэ package нэмэхгүй.
3. Frontend-ийн existing lint/build scripts болон backend-ийн existing test/start/check scripts-ийг ажиллуул.
4. Minimum:
   - TypeScript compile/build success
   - Lint success эсвэл existing unrelated lint errors-ийг ялгаж тайлагна
   - Public home smoke test
   - Admin product type CRUD smoke test
   - Product create/edit with `м²`, `ширхэг`, `метр`
   - Dimensions decimal test
   - Inventory inline update + refresh persistence test
5. Browser console/runtime error 0 байх.

---

# 10. Дуусахад надад өгөх тайлан

Код засварлаж дууссаны дараа зөвхөн ерөнхий “done” гэж битгий хэл. Дараахыг өг:

1. Өөрчилсөн файлуудын жагсаалт
2. Data/schema өөрчлөлт
3. Product type CRUD хэрхэн ажиллаж байгаа
4. Price unit логик
5. Width/length логик
6. Inventory page + inline edit логик
7. Legacy data migration ямар байдлаар хийсэн
8. Test/build үр дүн
9. Ямар нэг unresolved зүйл байвал яг юу дутуу байгааг

Хэрэв codebase-ийн бодит architecture дээр энэ spec-ийн field/name өөр байвал existing naming convention-ийг дага. Гол нь дээрх behavior бүр бүрэн ажилладаг байх ёстой.
