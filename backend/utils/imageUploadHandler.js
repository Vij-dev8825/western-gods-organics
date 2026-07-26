const multer = require('multer');
const fs = require('fs');
const cloudinary = require('./cloudinary');
const { compressAndStore } = require('./mediaStore');
const { UPLOADS_DIR } = require('../data/seed');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    cb(null, `${Date.now()}-${safe}`);
  },
});

// Shared by the admin product/category upload and the customer review-photo
// upload — same size/type limits and storage backend (Cloudinary when
// configured, else compressed-and-stored in the DB) regardless of who's uploading.
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only jpg/png/webp image files are allowed.'), ok);
  },
});

async function storeUploadedFile(file) {
  if (cloudinary.isConfigured()) {
    const { url } = await cloudinary.uploadFile(file.path, { resourceType: 'image' });
    fs.unlink(file.path, () => {});
    return url;
  }
  // No Cloudinary configured — compress and store in the database instead
  // of local disk, which Render's free plan wipes on every redeploy.
  const buffer = fs.readFileSync(file.path);
  const url = await compressAndStore(buffer);
  fs.unlink(file.path, () => {});
  return url;
}

module.exports = { imageUpload, storeUploadedFile };
