# JINTEMO / DROJ update spec

Энэ package нь `web zaswar hogjuuleltt.docx`-ийн 5 хуудасны шаардлагыг хэрэгжүүлэхэд зориулсан reference pack.

## Project paths (corrected)

- Frontend: `C:\Users\Tanusoft\Desktop\droj\jintemo_front-`
- Backend: `C:\Users\Tanusoft\Desktop\droj\jintemo_backend`
- Source DOCX: `C:\Users\Tanusoft\Desktop\droj\jintemo_front-\web zaswar hogjuuleltt.docx`
- Previous `D:\website\droj` path is incorrect and must not be used.

Frontend UI болон backend API/persistence-ийг нэг update гэж үзэж, шаардлагатай өөрчлөлтийг хоёр codebase-д уялдуулж хийнэ.

## Баталгаажсан шаардлагууд

1. Logo image-ийг container дотроо зөв голлуулах.
2. Admin бүтээгдэхүүний төрлийг өөрөө нэмж/хасаж/засаж чаддаг болгох; бүтээгдэхүүн нэмэхэд dynamic төрөл сонгодог байх.
3. Үнэ нэгжийг `м² / ширхэг / метр`-ээс admin сонгодог болгох. Дрож/хивсний үнэ м²-р хадгалагдах боломжтой байх.
4. Урт, өргөнийг тусдаа decimal field-ээр оруулах.
5. Үлдэгдлийг салбар бүрээр хөтлөх: Агуулах, Мишээл салбар, Одкон 2, Одкон 3.
6. Үлдэгдлийг Excel шиг хүснэгт дээрээс шууд өөрчилж хадгалдаг болгох.
7. Existing product list-ийн `Засах / Устгах` UX-г хэвээр үлдээхийн тулд sidebar-д тусдаа `Үлдэгдэл` page нэмэх хувилбарыг сонгов.

## Source зураг -> requirement map

- `01_logo_centering_reference.png` -> Logo alignment
- `02_public_product_types_reference.png` -> Public category/type presentation
- `03_admin_product_form_reference.png` -> Current add-product form
- `04_current_price_field_reference.png` -> Current hardcoded per-piece price field
- `05_unit_selector_reference.png` -> Desired unit dropdown concept
- `06_dimensions_reference.png` -> Desired separate length/width fields
- `07_product_inventory_table_reference.png` -> Current product list / stock context
- `08_admin_sidebar_inventory_menu_reference.png` -> Separate `Үлдэгдэл` menu idea

## Чухал implementation decision

DOCX-ийн 4-5-р хуудсанд 2 хувилбар байна: product table дотор салбарын stock columns нэмэх эсвэл тусдаа `Үлдэгдэл` menu/page хийх. Энэ pack нь 2 дахь хувилбарыг сонгосон. Ингэснээр existing `Бүтээгдэхүүн` list, `Засах`, `Устгах` хэсэгт өөрчлөлт бага орно.

## Data migration note

Existing single stock утгыг салбаруудад хэрхэн хуваарилах нь source requirement-д тодорхойгүй. Иймээс arbitrary split хийхгүй. Safe default migration: хуучин stock -> `Агуулах`, бусад салбар -> 0.
