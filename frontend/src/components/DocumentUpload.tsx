import React, { useRef, useState } from 'react';

interface Props {
  label: string;
  required?: boolean;
  onFilesSelected: (files: File[]) => void;
  uploadedCount?: number;
  disabled?: boolean;
}

export default function DocumentUpload({
  label,
  required = false,
  onFilesSelected,
  uploadedCount = 0,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setSelectedFiles(arr);
    onFilesSelected(arr);
  };

  const isUploaded = uploadedCount > 0;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
        <label style={{ fontSize: '14px', fontWeight: 500 }}>
          {label}
          {required && <span style={{ color: '#e74c3c', marginLeft: '2px' }}>*</span>}
        </label>
        {isUploaded && (
          <span style={{ background: '#d4edda', color: '#155724', padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
            ✓ Uploaded
          </span>
        )}
      </div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragging ? '#3498db' : isUploaded ? '#27ae60' : '#ccc'}`,
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: dragging ? '#ebf5fb' : isUploaded ? '#f0fdf4' : '#fafafa',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '4px' }}>
          {isUploaded ? '📄' : '📁'}
        </div>
        <div style={{ fontSize: '13px', color: '#555' }}>
          {selectedFiles.length > 0
            ? selectedFiles.map((f) => f.name).join(', ')
            : isUploaded
            ? `${uploadedCount} file(s) already uploaded`
            : 'Drop files here or click to browse'}
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          PDF, JPEG, PNG, DOC up to 10MB
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
          aria-label={`Upload ${label}`}
        />
      </div>
      {selectedFiles.length > 0 && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#27ae60' }}>
          {selectedFiles.length} file(s) ready to upload: {selectedFiles.map((f) => f.name).join(', ')}
        </div>
      )}
    </div>
  );
}
