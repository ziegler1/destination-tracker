import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { v4 as uuid } from 'uuid';
import { uploadFile, deleteFile, r2Configured } from '../lib/r2';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function multerSingle(req: Request, res: Response, next: NextFunction) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      // Drain the body so the browser gets a clean HTTP response
      req.resume();
      if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return void res.status(400).json({ error: 'File exceeds 5 MB limit' });
      }
      return void res.status(400).json({ error: (err as Error).message ?? 'Upload error' });
    }
    next();
  });
}

// POST /api/uploads
// Body (multipart): photo (file), resourceType (string, e.g. "destinations")
// Returns: { key, url }
router.post(
  '/',
  multerSingle,
  asyncHandler(async (req, res) => {
    if (!r2Configured()) {
      return void res.status(503).json({ error: 'Photo storage not configured (R2 env vars missing)' });
    }
    if (!req.file) {
      return void res.status(400).json({ error: 'No valid image file uploaded (max 5 MB, JPEG/PNG/WebP/GIF only)' });
    }
    const resourceType = (req.body.resourceType as string | undefined) ?? 'uploads';
    const ext = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const key = `${resourceType}/${uuid()}.${ext}`;
    const url = await uploadFile(key, req.file.buffer, req.file.mimetype);
    res.status(201).json({ key, url });
  }),
);

// DELETE /api/uploads?key=...
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const key = req.query.key as string | undefined;
    if (!key) return void res.status(400).json({ error: 'key query param required' });
    await deleteFile(key);
    res.status(204).send();
  }),
);

export default router;
