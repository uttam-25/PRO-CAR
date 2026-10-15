# PROWASH – Vehicle Inspection & AI Damage Detection

A complete mobile application for recording vehicle handover and return inspections, capturing before/after media, and running pixel-level AI damage comparison to detect new scratches, dents, and surface damage.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Backend Setup](#2-backend-setup)
3. [Mobile Setup](#3-mobile-setup)
4. [Physical Device Note](#4-physical-device-note)
5. [Environment Variables](#5-environment-variables)
6. [Project Structure](#6-project-structure)
7. [API Reference](#7-api-reference)
8. [AI Damage Detection — How It Works](#8-ai-damage-detection--how-it-works)
9. [Workflow Overview](#9-workflow-overview)

---

## 1. Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | v18 or later (tested on v24.12.0) |
| npm | v9 or later |
| MongoDB | Running locally on `127.0.0.1:27017` (no auth required) |
| Android emulator **or** physical Android device | Android 10+ recommended |
| Expo Go app | Install from Google Play Store on a physical device |
| Expo CLI | Installed globally via `npm install -g expo-cli`, or use `npx expo` |

Start MongoDB before running the backend. On Windows you can run:

```
net start MongoDB
```

or start it manually if you installed it as a standalone binary.

---

## 2. Backend Setup

```bash
cd "c:\Users\Dell\Desktop\PRO CAR\prowash-backend"
npm install
npm run dev
```

Expected output:

```
Connected to MongoDB at mongodb://127.0.0.1:27017/prowashdb
PROWASH backend running on port 5000
```

The backend listens on `0.0.0.0:5000` so both the Android emulator (`10.0.2.2:5000`) and physical devices on the same LAN can reach it.

To run without nodemon (production-style):

```bash
npm start
```

Uploaded media files are stored under `prowash-backend/uploads/` at runtime. This directory is created automatically on the first upload and is excluded from git.

---

## 3. Mobile Setup

```bash
cd "c:\Users\Dell\Desktop\PRO CAR\prowash-mobile"
npm install
npx expo start --android
```

This launches the Metro bundler and opens the app on the connected Android emulator. Metro will display a QR code — scan it with the Expo Go app on a physical device if you are not using an emulator.

To verify the bundle compiles without errors (no emulator needed):

```bash
npx expo export --platform android
```

No red screen errors should appear after export.

---

## 4. Physical Device Note

The emulator loopback address `10.0.2.2` is only valid inside the Android emulator. On a physical device you must use your development machine's LAN IP address instead.

**File to edit:** `prowash-mobile/src/services/api.js`

```js
// Change this line:
const BASE_URL = 'http://10.0.2.2:5000';

// To your machine's LAN IP, for example:
const BASE_URL = 'http://192.168.1.42:5000';
```

Find your LAN IP on Windows:

```powershell
ipconfig | Select-String "IPv4"
```

Both your phone and your development machine must be on the same Wi-Fi network.

---

## 5. Environment Variables

The backend reads from `prowash-backend/.env`. Create this file if it does not exist (it is excluded from git).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/prowashdb` | MongoDB connection string |
| `UPLOAD_DIR` | `./uploads` | Root directory for multer file storage (relative to `prowash-backend/`) |
| `NODE_ENV` | `development` | Set to `production` to suppress error stack traces in API responses |

Example `.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/prowashdb
UPLOAD_DIR=./uploads
NODE_ENV=development
```

---

## 6. Project Structure

```
PRO CAR/
├── prowash-backend/           Node.js + Express + MongoDB backend
│   ├── models/
│   │   ├── VehicleInspection.js   Mongoose schema for inspections
│   │   └── DamageReport.js        Mongoose schema for damage reports
│   ├── routes/
│   │   └── inspections.js         All 9 API endpoints
│   ├── services/
│   │   └── imageComparison.js     Sharp-based pixel-diff AI comparison engine
│   ├── middleware/
│   │   └── errorHandler.js        Express 4-arg error handler
│   ├── uploads/                   Runtime media storage (gitignored)
│   │   ├── before/<inspectionId>/ Before-inspection photos/videos
│   │   └── after/<inspectionId>/  After-inspection photos/videos + annotated images
│   ├── app.js                     Express app (routes, middleware, file serving)
│   ├── server.js                  MongoDB connect + app.listen
│   ├── .env                       Environment variables (gitignored)
│   └── package.json
│
└── prowash-mobile/            React Native + Expo mobile app
    ├── src/
    │   ├── constants/
    │   │   └── colors.js           Design system color palette
    │   ├── navigation/
    │   │   └── AppNavigator.js     Bottom tabs + nested stack navigators
    │   ├── screens/
    │   │   ├── NewInspectionScreen.js      Handover form, camera, before media
    │   │   ├── InspectionHistoryScreen.js  Scrollable list of all inspections
    │   │   ├── InspectionDetailScreen.js   Return workflow + compare trigger
    │   │   ├── DamageReportScreen.js       Damage report viewer
    │   │   └── ReportsScreen.js            Filtered list of completed reports
    │   └── services/
    │       └── api.js              Axios client — all backend calls live here
    ├── App.js                      Root component (GestureHandler + SafeAreaProvider)
    ├── babel.config.js
    └── package.json
```

---

## 7. API Reference

Base URL: `http://localhost:5000` (or `http://10.0.2.2:5000` from Android emulator)

All endpoints are prefixed with `/api`.

---

### 7.1 Create Inspection

Creates a new vehicle handover inspection. The server generates the `inspectionId` and `handoverTimestamp` — these cannot be supplied by the client.

**`POST /api/inspections`**

Request body (JSON):

```json
{
  "vehicleModel": "Hyundai Creta",
  "customerName": "Rajesh Kumar"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `vehicleModel` | string | Yes | Car brand/model name |
| `customerName` | string | No | Defaults to empty string |

Response `201 Created`:

```json
{
  "_id": "...",
  "inspectionId": "e307d1b3-85af-46fa-9c0a-d6eecc3fe2a9",
  "vehicleModel": "Hyundai Creta",
  "customerName": "Rajesh Kumar",
  "handoverTimestamp": "2025-01-15T10:30:00.000Z",
  "returnTimestamp": null,
  "returnStatus": "awaiting_return",
  "comparisonStatus": "not_compared",
  "damageReportId": null,
  "beforeMedia": [],
  "afterMedia": [],
  "createdAt": "2025-01-15T10:30:00.123Z",
  "updatedAt": "2025-01-15T10:30:00.123Z"
}
```

Error `400 Bad Request` if `vehicleModel` is missing or empty.

---

### 7.2 List All Inspections

Returns all inspections sorted newest first.

**`GET /api/inspections`**

No request body or query parameters.

Response `200 OK`: JSON array of inspection objects (same shape as 7.1 response). Returns `[]` if no inspections exist.

---

### 7.3 Get Single Inspection

**`GET /api/inspections/:inspectionId`**

Path parameter: `inspectionId` — the UUID string from the create response.

Response `200 OK`: single inspection object.

Error `404 Not Found` if the ID does not exist.

---

### 7.4 Upload Before-Inspection Media

Upload one or more photos/videos taken during vehicle handover. Must be called after 7.1.

**`POST /api/inspections/:inspectionId/before-media`**

Content-Type: `multipart/form-data`

Form field: `media` (repeat for multiple files, up to 20 files per request)

Accepted MIME types: `image/jpeg`, `image/png`, `video/mp4`, and other common image/video types. Sharp AI comparison only processes image files; videos are stored but skipped during comparison.

Files are saved to `uploads/before/<inspectionId>/`.

Response `200 OK`: updated inspection object with `beforeMedia` array populated.

Errors:
- `404` — inspection not found
- `400` — no files sent, or vehicle is already in `returned` state

---

### 7.5 Record Vehicle Return

Marks the inspection as returned and records the return timestamp. The server generates `returnTimestamp`. Call this before uploading after-media.

**`POST /api/inspections/:inspectionId/return`**

No request body required.

Response `200 OK`:

```json
{
  "inspectionId": "e307d1b3-...",
  "returnStatus": "returned",
  "returnTimestamp": "2025-01-16T14:45:00.000Z",
  ...
}
```

Error `409 Conflict` if `returnStatus` is already `returned` (prevents duplicate return submissions).

Error `404` if the inspection does not exist.

---

### 7.6 Upload After-Inspection Media

Upload return photos/videos. Requires the inspection to already be in `returned` state (call 7.5 first).

**`POST /api/inspections/:inspectionId/after-media`**

Content-Type: `multipart/form-data`

Form field: `media` (repeat for multiple files, up to 20 per request)

Files are saved to `uploads/after/<inspectionId>/`. Original before-media is never overwritten.

Response `200 OK`: updated inspection object with `afterMedia` array populated.

Errors:
- `400` — inspection not yet returned (call `/return` first), or no files sent
- `404` — inspection not found

---

### 7.7 Run AI Comparison

Compares before and after images using pixel-level analysis and generates a damage report. This endpoint is idempotent in one direction: it can only be called once per inspection. Once completed, retrieve the report using 7.8.

**`POST /api/inspections/:inspectionId/compare`**

No request body required.

This call may take several seconds on large images. The mobile app shows a loading modal during this time. Axios timeout is set to 120 seconds.

Response `200 OK`: the generated `DamageReport` object:

```json
{
  "_id": "...",
  "inspectionId": "e307d1b3-...",
  "vehicleModel": "Hyundai Creta",
  "customerName": "Rajesh Kumar",
  "handoverTimestamp": "2025-01-15T10:30:00.000Z",
  "returnTimestamp": "2025-01-16T14:45:00.000Z",
  "noDamageDetected": false,
  "warningMessage": "",
  "comparisonSummary": "Suspected damage detected in 1 of 2 compared image pair(s): 1 Medium. Results are labelled as SUSPECTED damage. Agent review and physical inspection are required before any conclusion.",
  "damageItems": [
    {
      "damageType": "Suspected surface damage",
      "location": "Middle-Right area",
      "severity": "Medium",
      "confidenceScore": 0.42,
      "description": "Pixel-level difference detected (MAD score: 12.54). Please review the annotated image to confirm. This is an automated estimate — agent verification is required."
    }
  ],
  "annotatedImages": [
    {
      "originalFilename": "1737030000000-uuid.jpg",
      "annotatedPath": "/absolute/path/to/uploads/after/<id>/annotated_1737030000000-uuid.jpg",
      "madScore": 12.54
    }
  ],
  "createdAt": "2025-01-16T14:46:10.000Z"
}
```

Errors:
- `409 Conflict` — comparison already completed; use GET `/report` instead
- `404` — inspection not found

If no images are available or only videos were uploaded, `warningMessage` is set and `noDamageDetected` is `false`.

---

### 7.8 Get Damage Report

Retrieve a previously generated damage report.

**`GET /api/inspections/:inspectionId/report`**

No request body.

Response `200 OK`: `DamageReport` object (same shape as 7.7 response).

Errors:
- `404` — inspection not found, or comparison has not been run yet

---

### 7.9 Serve Uploaded Files

Retrieve a stored media file (photo, video, or annotated image).

**`GET /api/uploads/:phase/:inspectionId/:filename`**

Examples:

```
GET /api/uploads/before/e307d1b3-.../1737030000000-uuid.jpg
GET /api/uploads/after/e307d1b3-.../1737030000000-uuid.jpg
GET /api/uploads/after/e307d1b3-.../annotated_1737030000000-uuid.jpg
```

Annotated images (generated by the comparison engine) use the prefix `annotated_` before the original filename.

Path traversal is blocked server-side: any path that resolves outside the `uploads/` directory returns `403 Forbidden`.

Response: the raw file with appropriate `Content-Type`. Returns `404` if the file does not exist.

---

## 8. AI Damage Detection — How It Works

PROWASH uses a **pixel-level image comparison** approach powered by the [sharp](https://sharp.pixelplumbing.com/) image processing library. No external AI API or network call is required — all processing runs locally on the backend machine.

### Algorithm

1. **Image pairing** — Before images and after images are paired by index (first before with first after, second with second, etc.). Videos are skipped; only JPEG, PNG, WebP, BMP, and TIFF files are compared.

2. **Normalisation** — Both images in a pair are resized to 640×480 pixels and converted to greyscale using sharp. This removes colour variation and lighting differences from different shots.

3. **Mean Absolute Difference (MAD)** — Each pair of pixel buffers is compared pixel-by-pixel. The MAD score is the average of `|pixelA − pixelB|` across all 307,200 pixels. A higher MAD score means more visual difference between the two images.

4. **Severity mapping:**

   | MAD Score | Severity |
   |---|---|
   | > 15 | High |
   | > 8 | Medium |
   | > 3 | Low |
   | ≤ 3 | No damage detected for this pair |

5. **Confidence score** — Calculated as `min(MAD / 30, 1.0)`, rounded to two decimal places. A score of `1.0` does not mean certainty — it means the pixel difference was large enough to saturate the scale.

6. **Damage location** — The image is divided into a 4-column × 3-row grid. The cell with the highest average pixel difference is identified and labelled with a human-readable position (e.g., "Middle-Right area", "Top-Left area").

7. **Annotation** — A semi-transparent red rectangle is composited over the after image at the identified damage region and saved as `annotated_<filename>` in the same `uploads/after/<inspectionId>/` directory.

### Limitations and Labelling

- All results are labelled **"Suspected surface damage"** and described as automated estimates. The system does not claim certainty.
- If the before and after images are taken from significantly different angles or distances, MAD scores will be inflated and the comparison will not be meaningful. The system warns when the number of before and after images differs by more than one.
- If photos are too dark, blurry, or show the vehicle from incompatible angles, the system displays: **"Please review the annotated image to confirm"** for each flagged pair.
- If no image files are found in either the before or after set, the report will contain: **"No media to compare. Please upload before and after images."**
- Agent review and physical inspection are always required before drawing any conclusions from the AI results.

### What the System Does Not Do

- It does not use a trained neural network or object detection model. There is no cloud API call.
- It cannot identify specific damage types (scratch vs dent vs broken light) — all flagged items are labelled "Suspected surface damage".
- It does not read video files. Only image files are analysed.

---

## 9. Workflow Overview

```
Agent opens app
    └─► New Inspection tab
            ├─ Search / type vehicle model
            ├─ (Optional) enter customer name
            ├─ Handover timestamp captured automatically
            ├─ Take photos / record video / pick from gallery  (before media)
            └─ [Save Handover Inspection]
                    │
                    ▼
           InspectionDetailScreen
                    │
            ┌───────┴───────┐
        awaiting         returned
        return
            │
   [Start Return Inspection]
            │
            ▼
   returnTimestamp captured automatically
            ├─ Take return photos / video / gallery  (after media)
            └─ [Compare Before & After]
                    │
                    ▼
          AI pixel comparison runs
                    │
             ┌──────┴──────┐
         damage        no damage
         found         detected
             │              │
      DamageReportScreen  "No obvious new damage detected."
      (annotated images,
       severity badges,
       comparison summary)

History tab ─► all inspections (awaiting / returned / report ready)
Reports tab ─► only inspections with completed comparison
```

---

*PROWASH is designed for use by car wash and vehicle inspection agents. AI results are estimates only and must be reviewed by a human agent before any action is taken.*
