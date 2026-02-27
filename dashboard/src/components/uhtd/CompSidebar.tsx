'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/Badge';

interface CompMatch {
  comp: {
    id: string;
    name: string | null;
    spaCount?: number;
  };
  matchingSpas: number;
  totalCompSpas: number;
  matchPercentage: number;
}

interface CompSidebarProps {
  selectedSpaIds: string[];
  categoryId?: string;
  onCompSelect: (compId: string) => void;
  onQuickview: (compId: string) => void;
}

export function CompSidebar({
  selectedSpaIds,
  categoryId,
  onCompSelect,
  onQuickview,
}: CompSidebarProps) {
  const [nearMatches, setNearMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedSpaIds.length === 0) {
      setNearMatches([]);
      return;
    }

    const fetchNearMatches = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/super-admin/comps/near-matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaModelIds: selectedSpaIds,
            categoryId,
            threshold: 0.5,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setNearMatches(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching near matches:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNearMatches();
  }, [selectedSpaIds, categoryId]);

  const getMatchLabel = (percentage: number) => {
    if (percentage >= 1) return 'Exact match';
    if (percentage >= 0.9) return `${Math.round(percentage * 100)}% match`;
    return `${Math.round(percentage * 100)}% overlap`;
  };

  const getMatchVariant = (percentage: number): 'success' | 'info' | 'warning' => {
    if (percentage >= 1) return 'success';
    if (percentage >= 0.9) return 'info';
    return 'warning';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Comp Suggestions</h3>
        <p className="text-xs text-gray-500 mt-1">
          Click to select all spas in a Comp
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : selectedSpaIds.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            Select spas to see Comp suggestions
          </div>
        ) : nearMatches.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No matching Comps found
          </div>
        ) : (
          <div className="space-y-2">
            {nearMatches.map((match) => (
              <div
                key={match.comp.id}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <button
                    onClick={() => onCompSelect(match.comp.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 text-left"
                  >
                    {match.comp.id}
                  </button>
                  <Badge variant={getMatchVariant(match.matchPercentage)} size="sm">
                    {getMatchLabel(match.matchPercentage)}
                  </Badge>
                </div>
                {match.comp.name && (
                  <div className="text-xs text-gray-600 mb-2">{match.comp.name}</div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{match.totalCompSpas} spas</span>
                  <button
                    onClick={() => onQuickview(match.comp.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Quickview
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          onClick={() => {
            // This would open a "Create New Comp" modal
            alert('Create New Comp modal would open here');
          }}
        >
          + Create New Comp
        </button>
      </div>
    </div>
  );
}
