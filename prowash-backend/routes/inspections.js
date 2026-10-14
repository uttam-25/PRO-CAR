const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const VehicleInspection = require('../models/VehicleInspection');
const DamageReport = require('../models/DamageReport');
const { compareImages } = require('../services/imageComparison');

// ─── Multer configuration ────────────────────────────────────────────────────

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

/**
 * Build a multer diskStorage engine for a given phase ('before' | 'after').
 * Destination is created on-the-fly so multer never fails on a missing dir.
 */
function makeStorage(phase) {
  return multer.diskStorage({
    destination: function (req, _file, cb) {
      const { inspectionId } = req.params;
      const dest = path.join(uploadsRoot, phase, inspectionId);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: function (_req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    }
  });
}

const uploadBefore = multer({ storage: makeStorage('before') });
const uploadAfter = multer({ storage: makeStorage('after') });

// ─── Helper ──────────────────────────────────────────────────────────────────

function mapFileToMedia(file) {
  return {
    filename: file.filename,
    originalname: file.originalname,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date()
  };
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// POST /api/inspections — create a new inspection
router.post('/', async (req, res, next) => {
  try {
    const { vehicleModel, customerName } = req.body;

    if (!vehicleModel || vehicleModel.trim() === '') {
      const err = new Error('vehicleModel is required.');
      err.status = 400;
      return next(err);
    }

    const inspection = new VehicleInspection({
      inspectionId: uuidv4(),
      vehicleModel: vehicleModel.trim(),
      customerName: (customerName || '').trim(),
      handoverTimestamp: new Date()
    });

    await inspection.save();
    return res.status(201).json(inspection);
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections — list all inspections sorted by createdAt desc
router.get('/', async (_req, res, next) => {
  try {
    const inspections = await VehicleInspection.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.json(inspections);
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections/:inspectionId — get a single inspection
router.get('/:inspectionId', async (req, res, next) => {
  try {
    const inspection = await VehicleInspection.findOne({
      inspectionId: req.params.inspectionId
    }).lean();

    if (!inspection) {
      const err = new Error('Inspection not found.');
      err.status = 404;
      return next(err);
    }

    return res.json(inspection);
  } catch (err) {
    next(err);
  }
});

// POST /api/inspections/:inspectionId/before-media — upload before-inspection files
router.post(
  '/:inspectionId/before-media',
  uploadBefore.array('media', 20),
  async (req, res, next) => {
    try {
      const inspection = await VehicleInspection.findOne({
        inspectionId: req.params.inspectionId
      });

      if (!inspection) {
        const err = new Error('Inspection not found.');
        err.status = 404;
        return next(err);
      }

      if (inspection.returnStatus === 'returned') {
        const err = new Error(
          'Cannot add before-media to an inspection that has already been returned.'
        );
        err.status = 400;
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        const err = new Error('No files were uploaded.');
        err.status = 400;
        return next(err);
      }

      inspection.beforeMedia.push(...req.files.map(mapFileToMedia));
      await inspection.save();
      return res.json(inspection);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/inspections/:inspectionId/return — record vehicle return
router.post('/:inspectionId/return', async (req, res, next) => {
  try {
    const inspection = await VehicleInspection.findOne({
      inspectionId: req.params.inspectionId
    });

    if (!inspection) {
      const err = new Error('Inspection not found.');
      err.status = 404;
      return next(err);
    }

    if (inspection.returnStatus === 'returned') {
      const err = new Error('Vehicle return has already been recorded for this inspection.');
      err.status = 409;
      return next(err);
    }

    inspection.returnTimestamp = new Date();
    inspection.returnStatus = 'returned';
    await inspection.save();
    return res.json(inspection);
  } catch (err) {
    next(err);
  }
});

// POST /api/inspections/:inspectionId/after-media — upload after-inspection files
router.post(
  '/:inspectionId/after-media',
  uploadAfter.array('media', 20),
  async (req, res, next) => {
    try {
      const inspection = await VehicleInspection.findOne({
        inspectionId: req.params.inspectionId
      });

      if (!inspection) {
        const err = new Error('Inspection not found.');
        err.status = 404;
        return next(err);
      }

      if (inspection.returnStatus !== 'returned') {
        const err = new Error(
          'Cannot upload after-media before the vehicle return has been recorded. ' +
          'Call POST /return first.'
        );
        err.status = 400;
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        const err = new Error('No files were uploaded.');
        err.status = 400;
        return next(err);
      }

      inspection.afterMedia.push(...req.files.map(mapFileToMedia));
      await inspection.save();
      return res.json(inspection);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/inspections/:inspectionId/compare — run AI comparison
router.post('/:inspectionId/compare', async (req, res, next) => {
  try {
    const inspection = await VehicleInspection.findOne({
      inspectionId: req.params.inspectionId
    });

    if (!inspection) {
      const err = new Error('Inspection not found.');
      err.status = 404;
      return next(err);
    }

    if (inspection.comparisonStatus === 'completed') {
      const err = new Error(
        'Comparison has already been completed for this inspection. ' +
        'Retrieve the existing report via GET /report.'
      );
      err.status = 409;
      return next(err);
    }

    inspection.comparisonStatus = 'in_progress';
    await inspection.save();

    try {
      const beforePaths = inspection.beforeMedia.map((m) => path.resolve(m.path));
      const afterPaths = inspection.afterMedia.map((m) => path.resolve(m.path));

      const result = await compareImages(beforePaths, afterPaths);

      const report = new DamageReport({
        inspectionId: inspection.inspectionId,
        vehicleModel: inspection.vehicleModel,
        customerName: inspection.customerName,
        handoverTimestamp: inspection.handoverTimestamp,
        returnTimestamp: inspection.returnTimestamp,
        damageItems: result.damageItems,
        annotatedImages: result.annotatedImages,
        comparisonSummary: result.comparisonSummary,
        noDamageDetected: result.noDamageDetected,
        warningMessage: result.warningMessage
      });
      await report.save();

      inspection.comparisonStatus = 'completed';
      inspection.damageReportId = report._id;
      await inspection.save();

      return res.json(report);
    } catch (compareErr) {
      inspection.comparisonStatus = 'failed';
      await inspection.save();
      throw compareErr;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/inspections/:inspectionId/report — retrieve damage report
router.get('/:inspectionId/report', async (req, res, next) => {
  try {
    const inspection = await VehicleInspection.findOne({
      inspectionId: req.params.inspectionId
    }).populate('damageReportId');

    if (!inspection) {
      const err = new Error('Inspection not found.');
      err.status = 404;
      return next(err);
    }

    if (!inspection.damageReportId) {
      const err = new Error(
        'No damage report exists for this inspection yet. Run the comparison first.'
      );
      err.status = 404;
      return next(err);
    }

    return res.json(inspection.damageReportId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
