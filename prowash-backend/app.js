require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const inspectionsRouter = require('./routes/inspections');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
// All inspection CRUD/media/compare endpoints are under /api/inspections
app.use('/api/inspections', inspectionsRouter);

// Serve uploaded files at GET /api/uploads/<relative-path>
// Path traversal guard: resolved path must stay inside the uploads directory
const uploadsRoot = path.resolve(__dirname, 'uploads');
app.get('/api/uploads/*', (req, res, next) => {
  const requestedSuffix = req.params[0]; // everything after /api/uploads/
  const resolvedPath = path.resolve(uploadsRoot, requestedSuffix);

  if (
    !resolvedPath.startsWith(uploadsRoot + path.sep) &&
    resolvedPath !== uploadsRoot
  ) {
    const err = new Error('Access denied.');
    err.status = 403;
    return next(err);
  }

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error('File not found.');
    err.status = 404;
    return next(err);
  }

  return res.sendFile(resolvedPath);
});

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
