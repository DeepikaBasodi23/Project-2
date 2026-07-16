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
  const hasSelected = selectedFiles.length > 0;

  const borderColor = dragging
    ? '#6366f1'
    : isUploaded || hasSelected
    ? '#10b981'
    : '#cbd5e1';

  const bgColor = dragging
    ? 'rgba(99,102,241,0.05)'
    : isUploaded || hasSelected
    ? 'rgba(16,185,129,0.04)'
    : '#fafafa';

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <label style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--gray-700)',
        }}>
          {label}
          {required && (
            <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>
          )}
        </label>
        {(isUploaded || hasSelected) && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
            color: '#065f46',
            padding: '2px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px solid #6ee7b7',
          }}>
            <span style={{ fontSize: '9px' }}>●</span>
            {hasSelected ? 'Selected' : 'Uploaded'}
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload ${label}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 'var(--radius)',
          padding: '20px 16px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: bgColor,
          opacity: disabled ? 0.55 : 1,
          transition: 'var(--transition)',
          userSelect: 'none',
        }}
      >
        {/* Icon */}
        <div style={{
          width: '44px',
          height: '44px',
          margin: '0 auto 10px',
          borderRadius: '12px',
          background: isUploaded || hasSelected
            ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
            : dragging
            ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)'
            : 'var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        }}>
          {isUploaded || hasSelected ? '✅' : dragging ? '📥' : '📁'}
        </div>

        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: isUploaded || hasSelected ? '#065f46' : 'var(--gray-600)',
          marginBottom: '4px',
        }}>
          {hasSelected
            ? selectedFiles.map((f) => f.name).join(', ')
            : isUploaded
            ? `${uploadedCount} file(s) already uploaded`
            : dragging
            ? 'Drop files here!'
            : 'Click to browse or drag & drop'}
        </div>

        <div style={{
          fontSize: '11px',
          color: 'var(--gray-400)',
        }}>
          PDF, JPEG, PNG, DOC — max 10 MB
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
    </div>
  );
}
