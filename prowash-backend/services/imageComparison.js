const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Compute Mean Absolute Difference between two greyscale pixel buffers.
 * Both buffers must have the same length.
 */
function computeMAD(bufA, bufB) {
  let sum = 0;
  for (let i = 0; i < bufA.length; i++) {
    sum += Math.abs(bufA[i] - bufB[i]);
  }
  return sum / bufA.length;
}

/**
 * Map a MAD score to a severity label.
 * MAD > 15  → High
 * MAD > 8   → Medium
 * MAD > 3   → Low
 * else      → no damage
 */
function getSeverity(mad) {
  if (mad > 15) return 'High';
  if (mad > 8) return 'Medium';
  if (mad > 3) return 'Low';
  return null; // no damage for this pair
}

/**
 * Divide a 640×480 image into a 4×3 grid and find the cell with the
 * highest average absolute difference. Returns the cell's bounding box
 * { left, top, width, height }.
 */
function findHighestDiffCell(bufA, bufB, imageWidth, imageHeight, cols, rows) {
  const cellW = Math.floor(imageWidth / cols);
  const cellH = Math.floor(imageHeight / rows);
  let bestCell = { col: 0, row: 0, avg: -1 };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let y = r * cellH; y < (r + 1) * cellH; y++) {
        for (let x = c * cellW; x < (c + 1) * cellW; x++) {
          const idx = y * imageWidth + x;
          sum += Math.abs(bufA[idx] - bufB[idx]);
          count++;
        }
      }
      const avg = count > 0 ? sum / count : 0;
      if (avg > bestCell.avg) {
        bestCell = { col: c, row: r, avg };
      }
    }
  }

  return {
    left: bestCell.col * cellW,
    top: bestCell.row * cellH,
    width: cellW,
    height: cellH
  };
}

/**
 * Draw a semi-transparent red rectangle overlay on an image at the
 * specified bounding box and save the result to annotatedPath.
 */
async function drawAnnotation(afterPath, bbox, annotatedPath) {
  const { left, top, width, height } = bbox;

  // Create a semi-transparent red rectangle as an SVG overlay
  const svgRect = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}"
            fill="rgba(255,0,0,0.35)" stroke="red" stroke-width="3"/>
    </svg>`
  );

  await sharp(afterPath)
    .composite([
      {
        input: svgRect,
        top: Math.round(top),
        left: Math.round(left)
      }
    ])
    .toFile(annotatedPath);
}

/**
 * Compare two sets of vehicle images (before vs after).
 *
 * @param {string[]} beforePaths  Absolute paths to before-inspection images.
 * @param {string[]} afterPaths   Absolute paths to after-inspection images.
 * @returns {Promise<{
 *   damageItems: object[],
 *   annotatedImages: object[],
 *   comparisonSummary: string,
 *   noDamageDetected: boolean,
 *   warningMessage: string
 * }>}
 */
async function compareImages(beforePaths, afterPaths) {
  // Guard: no media provided
  if (
    !Array.isArray(beforePaths) || !Array.isArray(afterPaths) ||
    beforePaths.length === 0 || afterPaths.length === 0
  ) {
    return {
      damageItems: [],
      annotatedImages: [],
      comparisonSummary: '',
      noDamageDetected: false,
      warningMessage: 'No media to compare. Please upload before and after images.'
    };
  }

  // Filter to image files only (skip videos)
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];
  const isImage = (p) => imageExts.includes(path.extname(p).toLowerCase());

  const beforeImages = beforePaths.filter(isImage);
  const afterImages = afterPaths.filter(isImage);

  if (beforeImages.length === 0 || afterImages.length === 0) {
    return {
      damageItems: [],
      annotatedImages: [],
      comparisonSummary: '',
      noDamageDetected: false,
      warningMessage:
        'No comparable image files found. Videos and non-image files are skipped in AI comparison. Please upload JPEG or PNG images.'
    };
  }

  let warningMessage = '';

  // Warn if the counts differ by more than 1 (angle mismatch)
  if (Math.abs(beforeImages.length - afterImages.length) > 1) {
    warningMessage =
      'The number of before and after images differs significantly. ' +
      'Some vehicle angles may not have a matching comparison image. ' +
      'Results may be less accurate — please upload matching views for best results.';
  }

  const pairsCount = Math.min(beforeImages.length, afterImages.length);

  const damageItems = [];
  const annotatedImages = [];
  const TARGET_W = 640;
  const TARGET_H = 480;
  const GRID_COLS = 4;
  const GRID_ROWS = 3;

  for (let i = 0; i < pairsCount; i++) {
    const beforePath = beforeImages[i];
    const afterPath = afterImages[i];
    const afterFilename = path.basename(afterPath);
    const afterDir = path.dirname(afterPath);

    try {
      // Resize both images to 640×480 greyscale, get raw pixel buffers
      const [bufA, bufB] = await Promise.all([
        sharp(beforePath)
          .resize(TARGET_W, TARGET_H, { fit: 'fill' })
          .greyscale()
          .raw()
          .toBuffer(),
        sharp(afterPath)
          .resize(TARGET_W, TARGET_H, { fit: 'fill' })
          .greyscale()
          .raw()
          .toBuffer()
      ]);

      const mad = computeMAD(bufA, bufB);
      const severity = getSeverity(mad);
      const confidenceScore = Math.round(Math.min(mad / 30, 1) * 100) / 100;

      if (severity) {
        // Find the grid cell with highest difference for bounding box
        const bbox = findHighestDiffCell(bufA, bufB, TARGET_W, TARGET_H, GRID_COLS, GRID_ROWS);

        // Scale bbox back to original image dimensions
        let origW = TARGET_W;
        let origH = TARGET_H;
        try {
          const meta = await sharp(afterPath).metadata();
          origW = meta.width || TARGET_W;
          origH = meta.height || TARGET_H;
        } catch (_) {
          // Use target dimensions as fallback
        }
        const scaledBbox = {
          left: Math.round((bbox.left / TARGET_W) * origW),
          top: Math.round((bbox.top / TARGET_H) * origH),
          width: Math.round((bbox.width / TARGET_W) * origW),
          height: Math.round((bbox.height / TARGET_H) * origH)
        };

        // Draw annotation on the after image
        const annotatedFilename = `annotated_${afterFilename}`;
        const annotatedPath = path.join(afterDir, annotatedFilename);
        await drawAnnotation(afterPath, scaledBbox, annotatedPath);

        // Map grid position to a human-readable location
        const colNames = ['Left', 'Center-Left', 'Center-Right', 'Right'];
        const rowNames = ['Top', 'Middle', 'Bottom'];
        const locationLabel = `${rowNames[Math.floor((bbox.top / TARGET_H) * GRID_ROWS)]}-${colNames[Math.floor((bbox.left / TARGET_W) * GRID_COLS)]} area`;

        damageItems.push({
          damageType: 'Suspected surface damage',
          location: locationLabel,
          severity,
          confidenceScore,
          description: `Pixel-level difference detected (MAD score: ${mad.toFixed(2)}). ` +
            `Please review the annotated image to confirm. ` +
            `This is an automated estimate — agent verification is required.`
        });

        annotatedImages.push({
          originalFilename: afterFilename,
          annotatedPath,
          madScore: Math.round(mad * 100) / 100
        });
      }
    } catch (err) {
      // Log and skip this pair; do not crash the whole comparison
      console.error(`[imageComparison] Error processing pair ${i} (${beforePath} vs ${afterPath}):`, err.message);
    }
  }

  const noDamageDetected = damageItems.length === 0;
  let comparisonSummary;

  if (noDamageDetected) {
    comparisonSummary = 'No obvious new damage detected. All compared image pairs show minimal pixel-level differences.';
  } else {
    const severityCounts = damageItems.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(severityCounts).map(([s, c]) => `${c} ${s}`);
    comparisonSummary =
      `Suspected damage detected in ${damageItems.length} of ${pairsCount} compared image pair(s): ${parts.join(', ')}. ` +
      `Results are labelled as SUSPECTED damage. Agent review and physical inspection are required before any conclusion.`;
  }

  return {
    damageItems,
    annotatedImages,
    comparisonSummary,
    noDamageDetected,
    warningMessage
  };
}

module.exports = { compareImages };
