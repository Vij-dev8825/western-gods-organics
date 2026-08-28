import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;

/** File-upload field for a product/category image — uploads immediately on
 * selection and reports the resulting URL back via onChange.
 *
 * allowClear adds a Remove link. Opt-in rather than always on, because most
 * places using this field want a picture and offering to delete it there is
 * only a way to end up with a product showing a blank square. It is on for
 * things where "no image" is a real answer, like the promo popup. */
export default function ImageUploadField({ value, onChange, label = 'Image', allowClear = false }) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB} MB (this file is ${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.admin.uploadImage(token, fd);
      onChange(res.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="image-upload-field">
        {value && <img src={getProductImage(value)} alt="" className="image-upload-preview" />}
        <label className={`btn btn-outline btn-sm image-upload-btn ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={uploading}
            hidden
          />
        </label>
        {allowClear && value && (
          <button
            type="button"
            className="link-btn danger"
            onClick={() => { setError(''); onChange(''); }}
          >
            Remove
          </button>
        )}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
