# JINTEMO / DROJ update pack

## Хэрхэн ашиглах

1. Энэ ZIP-ийг задла.
2. `PROMPT_CODEX_MN.md`-ийг Codex-д өг.
3. Codex-д дараах 2 working folder-ийг ашиглуул:
   - Frontend: `C:\Users\Tanusoft\Desktop\droj\jintemo_front-`
   - Backend: `C:\Users\Tanusoft\Desktop\droj\jintemo_backend`
4. Эх шаардлагын DOCX: `C:\Users\Tanusoft\Desktop\droj\jintemo_front-\web zaswar hogjuuleltt.docx`
5. `assets/reference/` хавтсыг reference screenshot байдлаар ашиглуул.
6. Codex-оос эхлээд frontend + backend architecture/data persistence/API contract-ийг хамтад нь шалгуулж, дараа нь prompt-ийн бүх acceptance criteria-г хийлгэ.

## Package contents

- `PROMPT_CODEX_MN.md` - шууд Codex-д өгөх дэлгэрэнгүй засварын prompt
- `CHANGE_SPEC.md` - requirements-ийн цэвэр spec + шийдвэрүүд
- `assets/reference/*` - DOCX-ээс гаргасан 8 reference image
- `SOURCE_web_zaswar_hogjuuleltt.docx` - эх шаардлагын файл

Анхаарах: `assets/reference/` зурагнууд нь production asset биш, зөвхөн шаардлага/UI reference. Production logo болон site assets-ийг frontend-ийн `C:\Users\Tanusoft\Desktop\droj\jintemo_front-\public`, `src`, `jintemo-logo.jpg`-оос ашиглана. Backend/API/data өөрчлөлтийг `C:\Users\Tanusoft\Desktop\droj\jintemo_backend` дээр хийнэ. Өмнөх `D:\website\droj` path-ийг ашиглахгүй.
