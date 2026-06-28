# Technical Documentation: Asset Manager Integration (`assetimplement.md`)

This document provides a detailed breakdown of the architectural and code modifications implemented to assimilate the visual, AI-driven Asset Library into the unified multi-tenant TRACE platform.

---

## 1. Architectural Strategy & Goals

The primary goal was to take a standalone desktop and mobile upload tool (`assets`) and weave it cleanly into the TRACE monorepo. The core challenges addressed were:
1. **Cloud Persistence vs. Local Files**: Merging the media scanning capability (which relies on local storage of captured photos on a local PC dev server) with the production database (Supabase).
2. **Schema Uniformity**: Letting any package inside `packages/` (specifically `ignition-os` and `cultivar-os` today, and future apps later) use the asset scanner without modifying the central scanner code.
3. **Robust Local Fallbacks**: Retaining full compatibility with the existing Python Tkinter desktop app and standalone mobile upload pages, while redirecting frontend dashboard queries to cloud database records.

---

## 2. Backend Implementation (FastAPI Refactoring)

### Absolute Path Configuration
- **File**: [`assets/config.py`](file:///c:/Dev/TRACE%20asset%20manager/trace-platform/assets/config.py)
- **Why**: By default, running Python commands from different directories (e.g. from the root folder via npm or directly from the `assets/` subfolder) changes the working directory, breaking relative path links to upload folders (`RawElementAssets/`) and database JSON config files.
- **How**: Configured absolute path resolutions relative to `__file__` (the location of `config.py` itself). This guarantees that media files and local configs are always saved inside the `assets/` subdirectory regardless of how the script is launched.

### Router & Endpoint Refactoring
- **File**: [`assets/server.py`](file:///c:/Dev/TRACE%20asset%20manager/trace-platform/assets/server.py)
- **Why**: Integrated backend endpoints needed to sit alongside potential platform API endpoints without name collisions.
- **How**: Refactored the core routes into a dedicated FastAPI `APIRouter` with the prefix `/api/assets`.
- **Static Assets Serving**: Mounted a `StaticFiles` endpoint under `/api/assets/files` to serve raw uploaded image assets recursively.
- **Crash Prevention**: Wrapped uvicorn's `start_server()` in a try-except block to gracefully catch port-binding failures (e.g., if port 8000 is already in use by the central platform dev setup).

---

## 3. Shared Frontend Component (Schema Adapter Pattern)

### Dynamic Database Bindings
- **File**: [`packages/shared/src/components/AssetManager.jsx`](file:///c:/Dev/TRACE%20asset%20manager/trace-platform/packages/shared/src/components/AssetManager.jsx)
- **Why**: Hardcoding vertical-specific tables (like `tools` in Ignition or `cost_objects` in Cultivar) inside the core media viewer would restrict reusability and break the platform's modular spine.
- **How**: Implemented a **Schema Adapter Pattern**. The component reads and writes data entirely dynamically using a `fieldMap` prop configuration passed from the parent packages:
  - If a logical field is mapped to a database column (e.g., mapping `imageUrl` to the `photo_url` column in `tools`), it operates on that column.
  - If a logical field is set to `null` (e.g. `notes: null` for the `tools` table which doesn't have a notes field), the component skips that database field to avoid throwing Postgres column errors.

### Rich Metadata Serialization
- **Why**: Tables like `tools` do not have columns for Gemini AI specifications or appraised prices. Adding these fields would require running database migrations across multiple vertical schemas.
- **How**: Created a JSON serialization layer in the notes column. When saving an asset, if the target table contains a `notes` column, the component serializes `imageUrl`, `specs`, `price`, and `userNotes` into a JSON block and saves it in the `notes` column. On load, if it detects a JSON block, it parses it back into detailed attributes, falling back to raw text notes otherwise.

### Theme accenter
- **Why**: Ignition OS employs a dark techno-blue aesthetic, while Cultivar OS uses a light, organic sage-green aesthetic.
- **How**: Configured a `theme` prop (`'light'` | `'dark'`) that switches the visual skin (background colors, buttons, hover text, and borders) of the shared component to match the host application.

---

## 4. Package Integration Details

### A. Ignition OS
- **File**: [`packages/ignition-os/modules/IgnitionAsset.jsx`](file:///c:/Dev/TRACE%20asset%20manager/trace-platform/packages/ignition-os/modules/IgnitionAsset.jsx)
- **Schema Mapping**:
  - Bound table: `tools`
  - Tenant ID: `shop_id`
  - Columns: `name`, `type` (as category), `brand`, `model`, `serial`, `barcode_id`, and `photo_url` (as `imageUrl`).
  - Constraint Safety: Set `notes: null` (since `tools` has no notes field). Passed `defaultInsertValues={{ status: 'ACTIVE' }}` to satisfy the status column check constraint.
  - Theme: `dark`

### B. Cultivar OS
- **File**: [`packages/cultivar-os/src/pages/BusinessAssets.tsx`](file:///c:/Dev/TRACE%20asset%20manager/trace-platform/packages/cultivar-os/src/pages/BusinessAssets.tsx)
- **Integration**: Added a `viewMode` toggle button ("Switch to Visual View" / "Switch to Editable Ledger") inside the primary asset list.
- **Schema Mapping**:
  - Bound table: `cost_objects`
  - Tenant ID: `business_id`
  - Columns: `name`, `asset_type` (as category), `make` (as brand), `model`, `serial_number`, `acquisition_cost` (as price), and `notes`.
  - Filter: Appended `.eq('node_type', 'ASSET').eq('is_active', true)`.
  - defaultInsertValues: Sets `node_type: 'ASSET'`, `is_active: true`, `status: 'ACTIVE'`, `cost_confidence: 'ESTIMATED'`.
  - Theme: `light`

---

## 5. Verification & Testing

Both application packages were successfully compiled in production mode to prove syntax and bundler coherence:
1. **Ignition OS**: Compiled successfully using Rollup/Vite.
2. **Cultivar OS**: Compiled successfully using Vite.
3. **FastAPI Server**: Verified syntax compatibility of backend routes using Python compilation hooks.
