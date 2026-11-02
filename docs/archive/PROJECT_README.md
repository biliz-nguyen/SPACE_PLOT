# SPACE_LOT · Premium UI v1

A React + TypeScript Aerospace Studio on the existing v0.4 engineering core. Tailwind CSS v4, local shadcn-style/Radix components, Lucide and Motion provide the new interface. Existing Three.js assembly, CAD import, My Hangar, AI Workshop, Community, wiring and engineering checks remain available.

Read [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for Windows PowerShell commands and the remaining migration work, [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the design tokens, [SKILLS_USED.md](SKILLS_USED.md) for applied skills, and [VALIDATION_PREMIUM.md](VALIDATION_PREMIUM.md) for actual test evidence. The original entry is retained at `/legacy.html` in the dev server.

## Run

```bash
npm ci
cp .env.example .env.local
# Fill the two public Supabase variables (or use the supplied connected config).
npm run dev
```

Node 22.12+ recommended. `npm ci` copies OpenCascade JS/WASM and its license notices into `public/cad/`. These generated files are intentionally not checked into Git. They are included in the production build. `npm run build` produces `dist/`; `npm run preview` serves that build.

## A real import pipeline

1. Select or drop models and their adjacent textures/buffers (32 files, 40 MiB total maximum).
2. Explicitly select source units and up axis for formats that do not define them.
3. Parse and validate. CAD tessellation runs in a separate worker with a 45-second timeout. STEP/IGES use explicit 0.1 mm tessellation deflection, not AI reconstruction. This is visualization tessellation, not exact B-rep editing or a tolerance guarantee.
4. Preserve geometry proportions; normalize to **meters, Y-up, centered pivot**. The engine converts canonical meters to its existing 100 mm scene units. No arbitrary fitting to component dimensions.
5. Reject empty/corrupt files, non-finite mesh vertices, unsupported required glTF extensions, missing or external dependencies and models above 750,000 triangles. Show dimensions, triangle count, byte size, provenance and warnings.
6. Show the real model in a separate interactive preview. Require the user's unit/axis/dimension confirmation before saving.
7. Save normalized GLB plus source file locally in IndexedDB. Custom catalog descriptors persist across reload. Add with a button (including mobile) or drag a saved asset from the sidebar onto the scene's ground plane.

| Input | Processing | Notes |
|---|---|---|
| GLB / glTF 2.0 | Three.js GLTFLoader | Meters + Y-up by specification; GLB must embed all dependencies. glTF adjacent buffers/textures must be selected together. No required Draco/KTX extensions. |
| OBJ + MTL | OBJLoader + MTLLoader | Select MTL and textures together; source units/up axis required. At most one MTL file. |
| STL | STLLoader | Explicit source units/up axis; neutral material. |
| PLY | PLYLoader | Mesh faces required; point clouds are rejected. |
| STEP / STP | OpenCascade WASM worker | CAD is tessellated directly; output forced to mm before normalization. |
| IGES / IGS | OpenCascade WASM worker | Same pipeline; surface tessellation, not a CAD feature tree. |
| BREP | OpenCascade WASM worker | Source units must be provided explicitly. |
| F3D / SLDPRT / DWG / FBX / others | Explicit unsupported message | Export STEP or uncompressed GLB first. These formats are not falsely reported as imported. |

Large or malformed files can still stress a browser while a mesh loader parses them. For heavy assemblies, split parts or simplify in CAD/Blender. No geometry healing, exact collision analysis, CAD constraints or manufacturing approval is performed.

## My hangar and tables

The private local hangar stores files in this browser. Clearing site data deletes those local copies: use **GLB ↓** to keep a backup. The existing assembly JSON export contains component references and coordinates, not mesh file bytes. A JSON referencing imported models can be opened on the same browser with its hangar available; moving a complete project to another device currently requires reimporting assets and recreating references. A portable project bundle is a future feature.

The assembly manifest supports text search and sorting by model, category or mass, with explicit millimeter/gram units and separate source/status columns. Unknown imported mass disables derived thrust/flight-time estimates and marks mass totals as incomplete. Community asset tables separate measured bounding boxes from unverified hardware specifications.

## Supabase community vault

Connected project: Optional Supabase backend. SQL migrations and the two Edge Functions are included under `supabase/`. New tables and the private `space-lot-models` bucket can be created in your own Supabase project. No sample user or model was left in the database.

- `community_assets`: metadata, immutable storage path, SHA-256, pending/approved/rejected state and reviewer audit fields.
- `model_requests`: user requests for a missing part.
- `generation_jobs`: provider task ownership, idempotency ID and a maximum of three generation slots per UTC day.
- Original CAD stays local. Only the normalized GLB is sent after explicit contribution consent.
- Contributions go to private review storage. **Only approved rows/files are visible to the public**. This is not an automatic upload into the public library.
- RLS permits a contributor to read their own pending submissions. Public clients have no table or storage write privileges. Edge Functions verify the real user with `auth.getUser()` on each request and perform writes on the server.
- Files are immutable to contributors. Owner approval checks the file again and compares SHA-256. App metadata authorization is checked using the server-verified Auth user; editable user metadata never grants privileges.
- Public access to approved files is still mediated by private Storage RLS. Making the bucket public would bypass that file access model; keep it private.

### Ten metadata groups

1. Model title.
2. Component category.
3. Manufacturer and model/revision.
4. Description, purpose and limits.
5. Author and source/provenance reference.
6. Sharing license (CC0, CC-BY-4.0, CC-BY-SA-4.0).
7. Measured mesh bounding box plus optional mass in grams.
8. Structured mechanical details (`mounting_holes_mm`, tolerances, material, datasheet source).
9. Structured electrical details (`voltage_v`, current limits, connector, exact pin map and source).
10. Import provenance: source format/units/up axis, AI/imported origin, normalization, tessellation settings and checksum.

Blank engineering fields mean **unknown**. Owner-reviewed geometry is not automatically a verified manufacturer specification. AI output remains an estimated visual mesh.

### Activate the owner's review account

There were **zero registered Auth users** at implementation time, so no owner identity was guessed or created. Create your account in Community, confirm the email and sign in. Then run the following in your Supabase SQL editor, replacing the address with your exact verified login:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"space_lot_admin"}'::jsonb
where email = 'YOUR_VERIFIED_EMAIL';
```

Sign out/in to refresh the JWT. The Community tab then displays the review queue. Use Inspect to preview the actual file, inspect its source/license/metadata, then Approve or Reject with a review note. Never put this role in `user_metadata`.

### Meshy configuration

Set **MESHY_API_KEY** in Supabase Dashboard → Edge Functions → Secrets. Never place it in a `VITE_` variable or Git. No Meshy key was supplied, so **no paid generation task was executed**.

The integrated adapter creates Meshy Text-to-3D preview tasks, polls status and downloads GLB through the authenticated server. The generated file goes through the same import and confirmation pipeline, with a user-entered approximate longest dimension and `AI VISUAL` provenance. It does not infer exact mechanical dimensions from a prompt or turn arbitrary CAD into an exact engineering model.

Provider POSTs are not automatically retried on timeouts: a provider may have accepted a billed task. The request remains recorded for owner reconciliation. The UI can resume the most recent provider task while signed into the same account. Other providers require an additional server adapter; the current UI does not pretend they are active.

Functions use `verify_jwt=false` at the gateway because they do their own mandatory `getUser(token)` authentication and reject missing/invalid tokens. Service credentials and Meshy secrets remain server-side. The maximum three daily generation slots are enforced with a database unique constraint; contribution/request quotas are a basic abuse guard, not a complete per-user storage billing system. Remove abandoned review uploads and rejected submissions as part of production operations.

## Validation

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite launches its own Vite server, tests real STL import, source scaling, preview consent, local persistence, scene insertion, STEP tessellation, malformed/external resource rejection, manifest search and mobile overflow. `CHROMIUM_EXECUTABLE=/path/to/chromium` may select an existing browser. Tests block remote font requests so screenshots and offline UI tests are deterministic.

See `VALIDATION.md` for actual run results and unresolved integration prerequisites. Original demo thrust, wiring and collision checks remain illustrative and do not approve flight hardware.

## Dependencies and references

- Three.js loaders/exporter: https://threejs.org/docs/
- occt-import-js: https://github.com/kovacsv/occt-import-js (LGPL-2.1 and bundled OpenCascade licenses copied alongside WASM).
- STEP test cube: upstream occt-import-js test fixture, preserved for integration testing.
- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Meshy Text-to-3D: https://docs.meshy.ai/en/api/text-to-3d
