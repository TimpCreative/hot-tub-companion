'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';

interface DataSourceMatch {
  value: string;
  count: number;
  similarity: number;
}

interface DataSourceInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function DataSourceInput({
  label = 'Data Source',
  value,
  onChange,
  placeholder = 'e.g., Official website, spec sheet',
  required = false,
}: DataSourceInputProps) {
  const fetchWithAuth = useSuperAdminFetch();
  const [suggestions, setSuggestions] = useState<DataSourceMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [similarWarning, setSimilarWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetchWithAuth(`/api/dashboard/super-admin/media/data-sources${params}`);
      const data = await response.json();

      if (data.success) {
        setSuggestions(data.data || []);

        if (search && data.data && data.data.length > 0) {
          const exactMatch = data.data.find(
            (s: DataSourceMatch) => s.value.toLowerCase() === search.toLowerCase()
          );
          const closeMatch = data.data.find(
            (s: DataSourceMatch) =>
              s.similarity > 0.7 &&
              s.similarity < 1 &&
              s.value.toLowerCase() !== search.toLowerCase()
          );

          if (exactMatch) {
            setSimilarWarning(null);
          } else if (closeMatch) {
            setSimilarWarning(`Similar existing: "${closeMatch.value}"`);
          } else {
            setSimilarWarning(null);
          }
        } else {
          setSimilarWarning(null);
        }
      }
    } catch (err) {
      console.error('Error fetching data sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setSimilarWarning(null);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setShowSuggestions(true);
    if (!value && suggestions.length === 0) {
      fetchSuggestions('');
    }
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setShowSuggestions(false);
    setSimilarWarning(null);
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            similarWarning ? 'border-yellow-400' : 'border-gray-300'
          }`}
          placeholder={placeholder}
          required={required}
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin w-4 h-4 text-gray-400"
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
          </div>
        )}
      </div>

      {similarWarning && (
        <p className="mt-1 text-sm text-yellow-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {similarWarning}
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {value && !suggestions.some((s) => s.value.toLowerCase() === value.toLowerCase()) && (
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
              Press Enter to use &quot;{value}&quot; or select below:
            </div>
          )}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              onClick={() => handleSelect(suggestion.value)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between group"
            >
              <span className="text-sm text-gray-900">{suggestion.value}</span>
              <span className="text-xs text-gray-400 group-hover:text-gray-600">
                used {suggestion.count}x
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
