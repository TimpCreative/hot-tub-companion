'use client';

import React, { useState, useRef, useCallback } from 'react';

interface MediaInputProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  accept?: 'image/*' | 'application/pdf' | '*/*';
  entityType?: string;
  entityId?: string;
  fieldName?: string;
  placeholder?: string;
  required?: boolean;
}

export function MediaInput({
  label,
  value,
  onChange,
  accept = '*/*',
  entityType,
  entityId,
  fieldName,
  placeholder = 'https://...',
  required = false,
}: MediaInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (entityType) formData.append('entityType', entityType);
        if (entityId) formData.append('entityId', entityId);
        if (fieldName) formData.append('fieldName', fieldName);

        const response = await fetch('/api/dashboard/super-admin/media/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Upload failed');
        }

        onChange(data.data.publicUrl);
        setUploadProgress(100);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, fieldName, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const isImage = value && (value.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || value.includes('image'));
  const displayName = value ? value.split('/').pop() : null;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex gap-3">
        {/* Left side: URL input */}
        <div className="flex-1">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder={placeholder}
            required={required}
          />

          {/* Preview */}
          {value && (
            <div className="mt-2">
              {isImage ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={value}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="truncate max-w-[150px]">{displayName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side: Upload zone */}
        <div
          className={`w-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-3 transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="text-center">
              <svg
                className="animate-spin w-6 h-6 text-blue-600 mx-auto mb-1"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-xs text-gray-500">Uploading...</span>
            </div>
          ) : (
            <>
              <svg
                className="w-6 h-6 text-gray-400 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-xs text-gray-500 text-center">
                Drop file or click
              </span>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
