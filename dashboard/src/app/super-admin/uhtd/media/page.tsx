'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface MediaFile {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  entityType: string | null;
  entityId: string | null;
  fieldName: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

const ENTITY_TYPES = [
  { value: '', label: 'All Entities' },
  { value: 'spa', label: 'Spas' },
  { value: 'part', label: 'Parts' },
  { value: 'brand', label: 'Brands' },
  { value: 'model-line', label: 'Model Lines' },
];

const FILE_TYPES = [
  { value: '', label: 'All Files' },
  { value: 'image/', label: 'Images' },
  { value: 'application/pdf', label: 'PDFs' },
  { value: 'application/vnd', label: 'Documents' },
  { value: 'text/csv', label: 'CSVs' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  return '📁';
}

export default function MediaLibraryPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 24;

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (entityType) params.set('entityType', entityType);
      if (mimeType) params.set('mimeType', mimeType);

      const response = await fetchWithAuth(`/api/dashboard/super-admin/media?${params}`);
      const data = await response.json();

      if (data.success) {
        setFiles(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, mimeType, fetchWithAuth]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/dashboard/super-admin/media/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Media Library</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total} file{total !== 1 ? 's' : ''} uploaded
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by filename..."
          />
        </div>

        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ENTITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={mimeType}
          onChange={(e) => {
            setMimeType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FILE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p>No files found</p>
          {(search || entityType || mimeType) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setEntityType('');
                setMimeType('');
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => setSelectedFile(file)}
              className="group cursor-pointer bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {isImage(file.mimeType) ? (
                  <img
                    src={file.publicUrl}
                    alt={file.originalFilename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">{getFileIcon(file.mimeType)}</span>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {file.originalFilename}
                </p>
                <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  File
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getFileIcon(file.mimeType)}</span>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {file.originalFilename}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {file.mimeType.split('/')[1]?.toUpperCase() || file.mimeType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {file.entityType ? (
                      <Badge variant="default">{file.entityType}</Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(file.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(file.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(file.publicUrl)}
                      >
                        Copy URL
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(file)}
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* File Detail Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        title="File Details"
      >
        {selectedFile && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
              {isImage(selectedFile.mimeType) ? (
                <img
                  src={selectedFile.publicUrl}
                  alt={selectedFile.originalFilename}
                  className="max-w-full max-h-[300px] object-contain rounded"
                />
              ) : (
                <span className="text-6xl">{getFileIcon(selectedFile.mimeType)}</span>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Filename</span>
                <span className="font-medium">{selectedFile.originalFilename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>{selectedFile.mimeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Size</span>
                <span>{formatFileSize(selectedFile.fileSize)}</span>
              </div>
              {selectedFile.entityType && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Entity</span>
                  <Badge variant="default">{selectedFile.entityType}</Badge>
                </div>
              )}
              {selectedFile.fieldName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Field</span>
                  <span>{selectedFile.fieldName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Uploaded</span>
                <span>{formatDate(selectedFile.createdAt)}</span>
              </div>
            </div>

            {/* URL */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <label className="block text-xs text-gray-500 mb-1">Public URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={selectedFile.publicUrl}
                  className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(selectedFile.publicUrl)}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteConfirm(selectedFile);
                  setSelectedFile(null);
                }}
              >
                Delete
              </Button>
              <a
                href={selectedFile.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">Open in New Tab</Button>
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete File"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deleteConfirm.originalFilename}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
