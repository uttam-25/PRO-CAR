# PROWASH – Vehicle Inspection & AI Damage Detection
# Implementation Plan

## Key Decisions

**Project is greenfield** — the workspace `c:\Users\Dell\Desktop\PRO CAR` was empty at planning time.
MongoDB is confirmed running locally on 127.0.0.1:27017. Node 24.12.0 and npm 11.6.2 are available.
npx expo 6.3.12 is installed globally.

**AI comparison strategy**: Use `sharp` for pixel-level image diffing (MAD — Mean Absolute Difference).
No external API key required, works fully offline. MAD>15 → High, MAD>8 → Medium, MAD>3 → Low severity.
Results are labeled "suspected damage" throughout the UI. If images can't be compared (size mismatch, missing
views) a "clearer photos needed" warning is shown instead of a fabricated result.

**No auth**: Inspections are addressed by UUIDs. The upload endpoint validates that the inspectionId exists
before accepting files. Media files are served via an authenticated-by-ID route, not a public static folder.

**Media storage**: Files are stored on disk under `prowash-backend/uploads/` in sub-folders
`before/<inspectionId>/` and `after/<inspectionId>/`. References (relative paths) are stored in MongoDB.

**API base URL for Android emulator**: `http://10.0.2.2:5000` (AVD loopback to host). Stored in
`prowash-mobile/src/services/api.js` as a constant that can be updated for physical devices.

**Navigation**: React Navigation v6 with bottom tabs (New Inspection · History · Reports) plus a stack
navigator nested inside each tab so detail screens slide in without losing the tab bar.

**State management**: React local state + Context for the current inspection being built; no Redux needed
at this scale.

---

## File Map

```
c:\Users\Dell\Desktop\PRO CAR\
├── .agents\
│   └── tasks\
│       └── prowash-plan.md          ← this file
│
├── prowash-backend\
│   ├── .env
│   ├── package.json
│   ├── app.js
│   ├── server.js
│   ├── middleware\
│   │   └── errorHandler.js
│   ├── models\
│   │   ├── VehicleInspection.js
│   │   └── DamageReport.js
│   ├── routes\
│   │   └── inspections.js
│   ├── services\
│   │   └── imageComparison.js
│   └── uploads\                     ← created at runtime by multer
│       ├── before\
│       └── after\
│
└── prowash-mobile\                  ← created by create-expo-app
    ├── app.json
    ├── App.js
    ├── babel.config.js
    ├── src\
    │   ├── services\
    │   │   └── api.js
    │   ├── constants\
    │   │   └── colors.js
    │   ├── navigation\
    │   │   └── AppNavigator.js
    │   └── screens\
    │       ├── NewInspectionScreen.js
    │       ├── InspectionHistoryScreen.js
    │       ├── InspectionDetailScreen.js
    │       ├── DamageReportScreen.js
    │       └── ReportsScreen.js
```

---

## Implementation Plan

- [ ] 1. **Create the backend project scaffold**
      Create `prowash-backend/` directory, run `npm init -y`, write `package.json` with all exact
      dependencies listed below, write `.env`, and run `npm install`.
      
      Exact `package.json` dependencies:
      ```json
      "dependencies": {
        "express": "4.18.2",
        "mongoose": "8.0.3",
        "multer": "1.4.5-lts.1",
        "cors": "2.8.5",
        "dotenv": "16.3.1",
        "uuid": "9.0.0",
        "sharp": "0.32.6"
      },
      "devDependencies": {
        "nodemon": "3.0.2"
      }
      ```

      `.env` content:
      ```
      PORT=5000
      MONGO_URI=mongodb://127.0.0.1:27017/prowashdb
      UPLOAD_DIR=./uploads
      NODE_ENV=development
      ```

      Add scripts to `package.json`:
      ```json
      "scripts": {
        "start": "node server.js",
        "dev": "nodemon server.js"
      }
      ```

      Files: `prowash-backend/package.json`, `prowash-backend/.env`
      Verify: `cd prowash-backend && npm install` completes with no errors; `node -e "require('express')"` exits 0.

- [ ] 2. **Write Mongoose models**
      Create `VehicleInspection.js` and `DamageReport.js` with these exact schemas:

      **VehicleInspection schema fields:**
      - `_id`: default ObjectId
      - `inspectionId`: String, unique, required (UUID v4, generated in route before save)
      - `vehicleModel`: String, required, trim
      - `customerName`: String, trim, default ''
      - `handoverTimestamp`: Date, required, immutable (set once by server, never updated)
      - `returnTimestamp`: Date, default null
      - `beforeMedia`: Array of objects `{ filename, originalname, path, mimetype, size, uploadedAt }`
      - `afterMedia`: Array of objects (same shape)
      - `comparisonStatus`: String, enum `['not_compared','in_progress','completed','failed']`, default `'not_compared'`
      - `returnStatus`: String, enum `['awaiting_return','returned']`, default `'awaiting_return'`
      - `damageReportId`: ObjectId ref `DamageReport`, default null
      - `createdAt`, `updatedAt`: timestamps: true

      **DamageReport schema fields:**
      - `inspectionId`: String, required, ref back to VehicleInspection.inspectionId
      - `vehicleModel`: String
      - `customerName`: String
      - `handoverTimestamp`: Date
      - `returnTimestamp`: Date
      - `damageItems`: Array of objects:
        `{ damageType, location, severity ('Low'|'Medium'|'High'), confidenceScore (Number 0-1), description }`
      - `annotatedImages`: Array of objects `{ originalFilename, annotatedPath, madScore }`
      - `comparisonSummary`: String
      - `noDamageDetected`: Boolean, default false
      - `warningMessage`: String, default ''
      - `createdAt`: Date, default Date.now

      Files: `prowash-backend/models/VehicleInspection.js`, `prowash-backend/models/DamageReport.js`
      Verify: `node -e "require('./models/VehicleInspection'); require('./models/DamageReport'); console.log('ok')"` (run from `prowash-backend/`) prints `ok`.

- [ ] 3. **Write the image comparison service**
      Create `prowash-backend/services/imageComparison.js`.

      The service exports one async function `compareImages(beforePaths, afterPaths)`:
      1. Accepts two arrays of absolute file paths (before and after images).
      2. For each pair (matched by array index), use `sharp` to:
         a. Resize both images to 640×480 greyscale.
         b. Get raw pixel buffers.
         c. Compute MAD (Mean Absolute Difference) = sum(|before[i]-after[i]|) / pixelCount.
      3. Assign severity: MAD > 15 → 'High', MAD > 8 → 'Medium', MAD > 3 → 'Low', else no damage.
      4. For pairs where MAD > 3, create an annotated JPEG: overlay a semi-transparent red rectangle
         on the `after` image in the region with the most concentrated difference (divide image into
         a 4×3 grid, find the cell with highest average diff, draw rect with `sharp` composite).
         Save annotated image to same directory as the after image, prefixed with `annotated_`.
      5. Return an object:
         ```js
         {
           damageItems: [ { damageType, location, severity, confidenceScore, description } ],
           annotatedImages: [ { originalFilename, annotatedPath, madScore } ],
           comparisonSummary: String,
           noDamageDetected: Boolean,
           warningMessage: String   // set if arrays have mismatched lengths or files are unreadable
         }
         ```
      6. If before/after arrays are empty or lengths differ by more than 1, set `warningMessage` and
         return `noDamageDetected: false` with empty arrays (do not crash).
      7. Confidence score = Math.min(madScore / 30, 1) rounded to 2 decimal places.

      Files: `prowash-backend/services/imageComparison.js`
      Verify: `node -e "const s=require('./services/imageComparison'); console.log(typeof s.compareImages)"` prints `function`.

- [ ] 4. **Write all REST API routes**
      Create `prowash-backend/routes/inspections.js` with the following 9 endpoints.
      Use `multer` with `diskStorage`: destination is determined by the route — before-media goes to
      `uploads/before/<inspectionId>/`, after-media goes to `uploads/after/<inspectionId>/`.
      Use `uuid` to generate `inspectionId` values.

      **Endpoints:**

      | Method | Path | Description |
      |--------|------|-------------|
      | POST | `/api/inspections` | Create inspection. Body: `{ vehicleModel, customerName? }`. Server sets `handoverTimestamp = new Date()`, generates `inspectionId`, saves doc, returns full doc. Reject if `vehicleModel` missing. |
      | GET | `/api/inspections` | List all inspections, sorted by `createdAt` desc. Returns array of docs with selected fields. |
      | GET | `/api/inspections/:inspectionId` | Get single inspection by `inspectionId`. 404 if not found. |
      | POST | `/api/inspections/:inspectionId/before-media` | Upload before photos/video. Multer multipart, field name `media`, max 20 files, max 200 MB each. Validate inspectionId exists. Push file objects to `beforeMedia` array. Return updated doc. Reject if `returnStatus === 'returned'`. |
      | POST | `/api/inspections/:inspectionId/return` | Start return. Set `returnTimestamp = new Date()`, set `returnStatus = 'returned'`. 409 if already returned. Return updated doc. |
      | POST | `/api/inspections/:inspectionId/after-media` | Upload after photos/video. Same multer config as before-media. Validate `returnStatus === 'returned'`. Push to `afterMedia`. Return updated doc. |
      | POST | `/api/inspections/:inspectionId/compare` | Run comparison. 409 if `comparisonStatus === 'completed'`. Set `comparisonStatus = 'in_progress'`. Retrieve `beforeMedia` and `afterMedia` paths. Call `imageComparison.compareImages()`. Create `DamageReport` doc. Set `comparisonStatus = 'completed'`, `damageReportId`. Return report. |
      | GET | `/api/inspections/:inspectionId/report` | Get damage report. Populate `damageReportId`. 404 if no report yet. |
      | GET | `/api/uploads/*` | Serve uploaded files. Map `*` to the `uploads/` directory. Set `Content-Type` based on extension. Validate that the requested path doesn't escape the uploads directory (path traversal guard). |

      Files: `prowash-backend/routes/inspections.js`
      Verify: routes file loads without syntax errors — `node -e "require('./routes/inspections')"` (from `prowash-backend/`).

- [ ] 5. **Write app.js and server.js with error handler middleware**
      
      `app.js`:
      - Require `express`, `cors`, `dotenv/config`, routes.
      - `app.use(cors())` — allow all origins (local dev, no auth).
      - `app.use(express.json())`, `app.use(express.urlencoded({ extended: true }))`.
      - Mount routes: `app.use('/api', inspectionRoutes)`.
      - Mount errorHandler last.
      - Export `app`.

      `server.js`:
      - Require `app`, `mongoose`, `dotenv/config`.
      - Connect mongoose to `MONGO_URI`.
      - On successful connection, `app.listen(PORT)`.
      - Log `PROWASH backend running on port ${PORT}`.

      `middleware/errorHandler.js`:
      - 4-argument Express error handler.
      - Return JSON `{ error: err.message, stack: (NODE_ENV==='development'?err.stack:undefined) }`.
      - Use status from `err.status || 500`.

      Files: `prowash-backend/app.js`, `prowash-backend/server.js`, `prowash-backend/middleware/errorHandler.js`
      Verify: `node server.js` starts without crashing and logs `PROWASH backend running on port 5000`
      (MongoDB must be running). Stop with Ctrl+C.

- [ ] 6. **Scaffold the Expo mobile app**
      From `c:\Users\Dell\Desktop\PRO CAR`, run:
      ```
      npx create-expo-app prowash-mobile --template blank
      ```
      This creates `prowash-mobile/` with a bare Expo + React Native JS project.

      Then `cd prowash-mobile` and install all required packages in one command:
      ```
      npx expo install expo-camera expo-image-picker expo-media-library expo-av expo-file-system expo-permissions
      npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack react-native-screens react-native-safe-area-context react-native-gesture-handler axios react-native-uuid @expo/vector-icons expo-constants
      ```

      After install, verify `app.json` has `"name": "prowash-mobile"` and `package.json` lists the
      installed packages.

      Files: `prowash-mobile/` (entire directory scaffolded by CLI)
      Verify: `npx expo --version` from the `prowash-mobile/` directory prints a version string.

- [ ] 7. **Create constants, API service, and navigation scaffold**
      
      Create `prowash-mobile/src/constants/colors.js`:
      ```js
      export const Colors = {
        midnightNavy: '#0B1B2B',
        oceanBlue:    '#147DAB',
        aqua:         '#40C4FF',
        cloudWhite:   '#F4F7FA',
        softGray:     '#E8EEF3',
        error:        '#E53935',
        success:      '#43A047',
        warning:      '#FB8C00',
        text:         '#1A2B3C',
        textLight:    '#6B7F8E',
      };
      ```

      Create `prowash-mobile/src/services/api.js`:
      - Import `axios`.
      - Base URL constant: `const BASE_URL = 'http://10.0.2.2:5000';`
      - Export functions:
        - `createInspection(vehicleModel, customerName)` → POST `/api/inspections`
        - `listInspections()` → GET `/api/inspections`
        - `getInspection(inspectionId)` → GET `/api/inspections/:inspectionId`
        - `uploadBeforeMedia(inspectionId, files)` → POST multipart `/api/inspections/:inspectionId/before-media`
        - `startReturn(inspectionId)` → POST `/api/inspections/:inspectionId/return`
        - `uploadAfterMedia(inspectionId, files)` → POST multipart `/api/inspections/:inspectionId/after-media`
        - `compareMedia(inspectionId)` → POST `/api/inspections/:inspectionId/compare`
        - `getReport(inspectionId)` → GET `/api/inspections/:inspectionId/report`
      - For multipart uploads, build `FormData`, append each file as `{ uri, name, type }`.
      - Add axios interceptors that log errors to console.

      Create `prowash-mobile/src/navigation/AppNavigator.js`:
      - Import `NavigationContainer` from `@react-navigation/native`.
      - Create a bottom tab navigator with 3 tabs: **New Inspection**, **History**, **Reports**.
      - Use `@expo/vector-icons` (MaterialCommunityIcons) for tab icons:
        - New Inspection: `car-check`
        - History: `clipboard-list`
        - Reports: `file-chart`
      - Tab bar style: background `#0B1B2B`, active tint `#40C4FF`, inactive tint `#6B7F8E`.
      - Each tab wraps a Stack navigator. New Inspection stack: `NewInspectionScreen` → `InspectionDetailScreen`.
        History stack: `InspectionHistoryScreen` → `InspectionDetailScreen`. Reports stack: `ReportsScreen` → `DamageReportScreen`.

      Update `prowash-mobile/App.js` to simply render `<AppNavigator />` with `GestureHandlerRootView`
      and `SafeAreaProvider` wrappers.

      Files: `prowash-mobile/src/constants/colors.js`, `prowash-mobile/src/services/api.js`,
             `prowash-mobile/src/navigation/AppNavigator.js`, `prowash-mobile/App.js`
      Verify: `npx expo export --platform android --output-dir /tmp/prowash-check 2>&1 | Select-String -Pattern "error|Error"` — no red errors (warnings about missing screens are acceptable at this stage; create stub screen files if needed to satisfy the navigator imports).

- [ ] 8. **Implement NewInspectionScreen**
      Create `prowash-mobile/src/screens/NewInspectionScreen.js`.

      This screen is the primary handover form. It must:
      1. Show a styled header: "PROWASH" in aqua on midnight navy.
      2. **Vehicle model search**: A `TextInput` that filters a hardcoded list of models as the user types.
         Models list: `['Maruti Swift', 'Hyundai Creta', 'Tata Nexon', 'Mahindra Scorpio', 'Toyota Innova',
         'Honda City', 'Kia Seltos', 'Maruti Baleno', 'Hyundai Venue', 'Tata Altroz', 'Maruti Brezza',
         'Mahindra XUV700', 'Toyota Fortuner', 'Honda Amaze', 'Renault Kwid']`.
         Show suggestions in a `FlatList` below the input; tapping a suggestion fills the input.
         If the typed value is not in the list, use it as-is (manual entry allowed).
      3. **Customer name**: Optional `TextInput`, placeholder "Owner / Customer Name (optional)".
      4. **Handover timestamp**: Display auto-captured device time in format `DD/MM/YYYY, HH:MM:SS`.
         Use `new Date()` captured when the screen mounts. Show in a read-only styled box. Refresh every
         second with `setInterval` until the user presses Save.
      5. **Before media section**: Two buttons side by side:
         - "📷 Take Photo" — call `ImagePicker.launchCameraAsync` with `allowsMultipleSelection: false`
           (call multiple times, user presses again for more).
         - "🎥 Record Video" — call `ImagePicker.launchCameraAsync` with `mediaTypes: 'Videos'`.
         - "🖼 Choose from Gallery" — call `ImagePicker.launchImageLibraryAsync` with
           `allowsMultipleSelection: true`, `mediaTypes: 'All'`.
         Show thumbnails of selected media in a horizontal `ScrollView`.
         Allow removing individual items by tapping an ✕ button on the thumbnail.
      6. **Save Handover Inspection button**: On press:
         a. Validate vehicleModel is not empty.
         b. Call `api.createInspection(vehicleModel, customerName)` — receive `{ inspectionId }`.
         c. If `beforeMediaList` is not empty, call `api.uploadBeforeMedia(inspectionId, beforeMediaList)`.
         d. Show success toast / alert.
         e. Navigate to `InspectionDetailScreen` with `{ inspectionId }` as param.
      7. Show a loading overlay during API calls. Show inline error messages on failure.
      8. Request `CAMERA` and `MEDIA_LIBRARY` permissions on mount using `expo-permissions` or the
         individual package permission hooks. Show a message if permissions are denied.

      Files: `prowash-mobile/src/screens/NewInspectionScreen.js`
      Verify: App loads on emulator/device showing the form without crash. Vehicle model suggestions appear
      when typing. Media thumbnails appear after selection. Check with `npx expo start --android`.

- [ ] 9. **Implement InspectionHistoryScreen**
      Create `prowash-mobile/src/screens/InspectionHistoryScreen.js`.

      This screen shows all saved inspections:
      1. On mount and on focus, call `api.listInspections()`.
      2. Render a `FlatList` of cards. Each card shows:
         - Vehicle model (bold, large).
         - Customer name (if present).
         - Handover date/time formatted as `DD/MM/YYYY HH:MM`.
         - Return status badge: orange "Awaiting Return" or green "Returned".
         - Comparison badge: gray "Not Compared" or teal "Report Ready".
      3. Tapping a card navigates to `InspectionDetailScreen` with `{ inspectionId }`.
      4. Pull-to-refresh with `RefreshControl`.
      5. Show an empty state illustration (a simple SVG-less placeholder with icon + text
         "No inspections yet. Start a new inspection.") when list is empty.
      6. Show a loading spinner on initial fetch.

      Files: `prowash-mobile/src/screens/InspectionHistoryScreen.js`
      Verify: After creating an inspection from NewInspectionScreen, it appears in the History tab.

- [ ] 10. **Implement InspectionDetailScreen**
       Create `prowash-mobile/src/screens/InspectionDetailScreen.js`.

       This screen is the hub for a single inspection. It has two sections:

       **Handover section (top, read-only):**
       - Vehicle model, customer name, handover timestamp.
       - Horizontal scroll of before-media thumbnails (photos show as images; videos show a play-icon
         placeholder with filename). Tapping opens full-screen view.
       - Before-media count badge.

       **Return section (bottom):**
       - If `returnStatus === 'awaiting_return'`:
         - Show "Start Return Inspection" button. On press, call `api.startReturn(inspectionId)`,
           which sets `returnTimestamp` on the server. Reload inspection data.
       - If `returnStatus === 'returned'`:
         - Show `returnTimestamp` in same read-only styled box.
         - Show after-media upload buttons (same Take Photo / Record Video / Gallery pattern as
           NewInspectionScreen).
         - Show thumbnails of already-uploaded after media.
         - "Upload More" button to add additional media.
         - **Compare Before & After** button (prominent, aqua background). On press:
           a. Show a loading modal "Analyzing images… This may take a moment."
           b. Call `api.compareMedia(inspectionId)`.
           c. On success, navigate to `DamageReportScreen` with `{ inspectionId }`.
           d. On error, show error message.
         - If `comparisonStatus === 'completed'`: show "View Report" button instead of compare button,
           navigating to `DamageReportScreen`.

       Files: `prowash-mobile/src/screens/InspectionDetailScreen.js`
       Verify: Full handover→return flow works end-to-end: create inspection, view detail, start return,
       upload after photos, press Compare. Backend logs should show the compare endpoint being hit.

- [ ] 11. **Implement DamageReportScreen**
       Create `prowash-mobile/src/screens/DamageReportScreen.js`.

       This screen displays the AI comparison results:
       1. Header: "Damage Report" with vehicle model subtitle.
       2. Inspection summary card: vehicle model, customer name, handover time, return time.
       3. **No damage case**: If `noDamageDetected === true`, show a green banner
          "✅ No obvious new damage detected." Stop rendering further damage items.
       4. **Warning case**: If `warningMessage` is not empty, show an amber banner with the message.
       5. **Damage items list**: For each item in `damageItems`:
          - Severity badge (red=High, orange=Medium, yellow=Low).
          - Damage type and location.
          - Confidence score as a percentage bar.
          - Description text.
       6. **Side-by-side comparison**: For each annotated image in `annotatedImages`:
          - Show before image (fetched from `GET /api/uploads/before/<inspectionId>/<filename>`) on left.
          - Show annotated after image (fetched from `GET /api/uploads/after/<inspectionId>/annotated_<filename>`)
            on right.
          - Label each: "Before" / "After (annotated)".
       7. Comparison summary paragraph at the bottom.
       8. Disclaimer text in small gray: "Results indicate suspected damage only. Professional inspection
          recommended for insurance or legal purposes."
       9. Fetch report from `api.getReport(inspectionId)` on mount.

       Files: `prowash-mobile/src/screens/DamageReportScreen.js`
       Verify: After running Compare from InspectionDetailScreen, DamageReportScreen shows either the
       damage items with annotated images or the "no damage" banner.

- [ ] 12. **Implement ReportsScreen**
       Create `prowash-mobile/src/screens/ReportsScreen.js`.

       This screen lists all inspections that have a completed damage report:
       1. Call `api.listInspections()` and filter to `comparisonStatus === 'completed'`.
       2. Render cards showing: vehicle model, customer name, date, damage item count, severity summary.
       3. Tapping navigates to `DamageReportScreen` with `{ inspectionId }`.
       4. Empty state: "No reports yet. Complete an inspection comparison to see reports here."
       5. Pull-to-refresh.

       Files: `prowash-mobile/src/screens/ReportsScreen.js`
       Verify: Reports tab shows completed inspection reports. Tapping opens the correct DamageReportScreen.

- [ ] 13. **Wire up stub screens and do final App.js integration**
       Ensure `App.js` correctly imports and renders `AppNavigator`. Confirm all five screen files are
       imported in the navigator. Add any missing `gestureHandlerRootHOC` wrapping for the stack
       navigators. Verify `babel.config.js` includes the `react-native-reanimated` plugin if installed
       (add `plugins: ['react-native-reanimated/plugin']` to the babel config).

       Files: `prowash-mobile/App.js`, `prowash-mobile/babel.config.js`,
              `prowash-mobile/src/navigation/AppNavigator.js`
       Verify: `npx expo start` launches Metro bundler without errors. App opens on Android to the
       "New Inspection" tab.

- [ ] 14. **End-to-end smoke test and README**
       Start backend: `cd prowash-backend && npm run dev`.
       Start mobile: `cd prowash-mobile && npx expo start --android`.
       Run through the full flow:
       1. Create a new inspection with vehicle model and photo.
       2. View it in History.
       3. Open it, start return, upload at least one after photo.
       4. Press Compare Before & After.
       5. View Damage Report.
       6. Check Reports tab.

       Write `c:\Users\Dell\Desktop\PRO CAR\README.md` documenting:
       - Prerequisites (Node, npm, MongoDB local, Android emulator or Expo Go).
       - How to start the backend (`npm run dev`).
       - How to start the mobile app (`npx expo start --android`).
       - How to run on a physical Android device (change `10.0.2.2` to local IP in `api.js`).
       - API endpoint reference (all 9 endpoints with request/response shapes).
       - AI comparison explanation and how to interpret results.
       - Environment variables reference.

       Files: `c:\Users\Dell\Desktop\PRO CAR\README.md`
       Verify: Full flow completes without errors. README is present and readable.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `sharp` binary install fails on Windows | Use `npm install --ignore-scripts` fallback; sharp ships prebuilt binaries for Node 24 on Windows x64 via `@img/sharp-win32-x64` — should install cleanly. |
| Expo SDK camera/permissions API differences | Use `expo-camera` v14+ `useCameraPermissions()` hook pattern; fall back to `expo-permissions` if hook unavailable. |
| Android emulator can't reach `10.0.2.2:5000` | Backend must bind to `0.0.0.0` (Express default); ensure Windows Firewall allows port 5000 inbound. |
| Image size mismatch in comparison | Service resizes both images to 640×480 before diffing — size mismatch is never a runtime error. |
| Large video upload timeouts | Set `axios.defaults.timeout = 120000` (2 min) in `api.js`; multer limit is 200 MB per file. |
| MongoDB ObjectId vs string inspectionId confusion | Routes consistently use `inspectionId` (UUID string) for external API; `_id` (ObjectId) is never exposed in API responses. |

---

## Implementation Order Summary (dependency chain)

```
Step 1 (backend scaffold)
  └── Step 2 (models)
        └── Step 3 (comparison service)
              └── Step 4 (routes) — depends on models + service
                    └── Step 5 (app.js/server.js) — depends on routes
                          │
                          ▼
                    Backend complete — start separately
                          │
Step 6 (Expo scaffold)
  └── Step 7 (constants + api + navigation)
        ├── Step 8 (NewInspectionScreen)
        ├── Step 9 (InspectionHistoryScreen)
        ├── Step 10 (InspectionDetailScreen) — depends on 8+9
        ├── Step 11 (DamageReportScreen) — depends on 10
        └── Step 12 (ReportsScreen)
              └── Step 13 (final wiring + babel)
                    └── Step 14 (smoke test + README)
```
