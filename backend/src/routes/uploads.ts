import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { uploadFile, deleteFile } from '../lib/r2';
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

// POST /api/uploads
// Body (multipart): photo (file), resourceType (string, e.g. "destinations")
// Returns: { key, url }
router.post(
  '/',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return void res.status(400).json({ error: 'No valid image file uploaded (max 5 MB)' });
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
