'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type TenantMediaInputProps = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  fieldName: 'logo_url' | 'icon_url';
  accept?: 'image/*' | '*/*';
};

export function TenantMediaInput({
  label,
  value,
  onChange,
  fieldName,
  accept = 'image/*',
}: TenantMediaInputProps) {
  const { getIdToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const token = await getIdToken();
        if (!token) throw new Error('Not authenticated');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fieldName', fieldName);

        const response = await fetch('/api/dashboard/proxy/admin/settings/branding/media/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const text = await response.text();
        let data: Record<string, unknown>;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            response.ok
              ? 'Invalid response from server'
              : `Upload failed (${response.status}): ${text || 'Server returned empty response'}`
          );
        }
        if (!response.ok) {
          const err = data?.error as { message?: string } | undefined;
          throw new Error(err?.message || (data?.message as string) || 'Upload failed');
        }
        const url = (data?.data as { publicUrl?: string })?.publicUrl;
        if (url) onChange(url);
      } catch (e: any) {
        setError(e?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [fieldName, getIdToken, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
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

  const isImage = Boolean(value);

  return (
    <div className="space-y-1">
      {label ? (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}

      {value && isImage ? (
        <div className="mb-2">
          <img src={value} alt="Uploaded preview" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
        </div>
      ) : null}

      <div
        className={`w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-3 transition-colors cursor-pointer ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />

        {uploading ? (
          <div className="text-center">
            <span className="text-xs text-gray-500">Uploading…</span>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-xs text-gray-500">Drop image or click</span>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Images only. Min 1KB, max 10MB.
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

