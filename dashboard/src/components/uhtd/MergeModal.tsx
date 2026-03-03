'use client';

import { useState, useEffect } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type EntityType = 'brand' | 'model-line' | 'spa';

interface SelectedItem {
  id: string;
  name: string;
}

interface MergePreview {
  target: { id: string; name: string };
  sources: { id: string; name: string }[];
  affectedCounts: Record<string, number>;
}

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  selectedItems: SelectedItem[];
  onMergeComplete: () => void;
}

const entityLabels: Record<EntityType, { singular: string; plural: string }> = {
  brand: { singular: 'Brand', plural: 'Brands' },
  'model-line': { singular: 'Model Line', plural: 'Model Lines' },
  spa: { singular: 'Spa', plural: 'Spas' },
};

const affectedLabels: Record<string, string> = {
  modelLines: 'Model Lines',
  spaModels: 'Spa Models',
  visibilityRecords: 'Visibility Records',
  partCompatibility: 'Part Compatibility Records',
  compSpas: 'Comp Assignments',
  qualifiers: 'Qualifiers',
  spaProfiles: 'User Spa Profiles',
};

export function MergeModal({ isOpen, onClose, entityType, selectedItems, onMergeComplete }: MergeModalProps) {
  const fetchWithAuth = useSuperAdminFetch();
  const [targetId, setTargetId] = useState<string>('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const labels = entityLabels[entityType];

  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      setTargetId(selectedItems[0].id);
      setPreview(null);
      setError(null);
    }
  }, [isOpen, selectedItems]);

  useEffect(() => {
    if (targetId && selectedItems.length >= 2) {
      fetchPreview();
    }
  }, [targetId]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);

    const sourceIds = selectedItems.filter(item => item.id !== targetId).map(item => item.id);

    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/merge/${entityType}s/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, sourceIds }),
      });

      const data = await res.json();
      if (data.success) {
        setPreview(data.data);
      } else {
        setError(data.error?.message || 'Failed to load preview');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    setMerging(true);
    setError(null);

    const sourceIds = selectedItems.filter(item => item.id !== targetId).map(item => item.id);

    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/merge/${entityType}s`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, sourceIds }),
      });

      const data = await res.json();
      if (data.success) {
        onMergeComplete();
        onClose();
      } else {
        setError(data.error?.message || 'Merge failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMerging(false);
    }
  };

  const sourceItems = selectedItems.filter(item => item.id !== targetId);
  const targetItem = selectedItems.find(item => item.id === targetId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Merge ${labels.plural}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={merging}>
            Cancel
          </Button>
          <Button 
            onClick={handleMerge} 
            loading={merging}
            disabled={!preview || loading || selectedItems.length < 2}
          >
            Merge {sourceItems.length} {sourceItems.length === 1 ? labels.singular : labels.plural}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {selectedItems.length < 2 ? (
          <p className="text-gray-500">Select at least 2 {labels.plural.toLowerCase()} to merge.</p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keep (Target):
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {selectedItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This {labels.singular.toLowerCase()} will remain after the merge.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Merge Into Target ({sourceItems.length}):
              </label>
              <div className="space-y-2">
                {sourceItems.map(item => (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-sm text-red-700">{item.name}</span>
                    <span className="text-xs text-red-500">(will be deleted)</span>
                  </div>
                ))}
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading preview...</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {preview && !loading && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-900 mb-2">What will happen:</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <strong>{targetItem?.name}</strong> will be kept
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {sourceItems.length} {sourceItems.length === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()} will be deleted
                  </li>
                </ul>
                
                {Object.keys(preview.affectedCounts).length > 0 && (
                  <>
                    <h4 className="font-medium text-amber-900 mt-4 mb-2">Records to be updated:</h4>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {Object.entries(preview.affectedCounts).map(([key, count]) => (
                        count > 0 && (
                          <li key={key} className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {count} {affectedLabels[key] || key}
                          </li>
                        )
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
