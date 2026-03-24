'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface Column {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  width?: string;
  group?: string;
}

interface BulkAddTableProps {
  columns: Column[];
  onSubmit: (rows: Record<string, any>[]) => Promise<{ success: number; failed: number; errors?: string[] }>;
  minRows?: number;
  maxRows?: number;
  title?: string;
}

export function BulkAddTable({ columns, onSubmit, minRows = 5, maxRows = 50, title }: BulkAddTableProps) {
  const createEmptyRow = () => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.key] = col.type === 'checkbox' ? false : '';
    });
    return row;
  };

  const [rows, setRows] = useState<Record<string, any>[]>(() => 
    Array.from({ length: minRows }, createEmptyRow)
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors?: string[] } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateCell = (rowIndex: number, key: string, value: any) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [key]: value };
      return newRows;
    });
    setResult(null);
  };

  const addRows = (count: number = 5) => {
    if (rows.length >= maxRows) return;
    const newCount = Math.min(count, maxRows - rows.length);
    setRows((prev) => [...prev, ...Array.from({ length: newCount }, createEmptyRow)]);
  };

  const removeEmptyRows = () => {
    setRows((prev) => {
      const nonEmptyRows = prev.filter((row) => 
        columns.some((col) => {
          const val = row[col.key];
          return val !== '' && val !== false && val !== null && val !== undefined;
        })
      );
      return nonEmptyRows.length > 0 ? nonEmptyRows : [createEmptyRow()];
    });
  };

  const clearAll = () => {
    setRows(Array.from({ length: minRows }, createEmptyRow));
    setResult(null);
  };

  const handleSubmit = async () => {
    const nonEmptyRows = rows.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val !== '' && val !== false && val !== null && val !== undefined;
      })
    );

    if (nonEmptyRows.length === 0) {
      setResult({ success: 0, failed: 0, errors: ['No data to submit'] });
      return;
    }

    setSubmitting(true);
    try {
      const submitResult = await onSubmit(nonEmptyRows);
      setResult(submitResult);
      
      if (submitResult.success > 0 && submitResult.failed === 0) {
        clearAll();
      }
    } catch (err) {
      console.error('Bulk add error:', err);
      setResult({ success: 0, failed: nonEmptyRows.length, errors: ['An error occurred'] });
    } finally {
      setSubmitting(false);
    }
  };

  const filledRowCount = rows.filter((row) =>
    columns.some((col) => {
      const val = row[col.key];
      return val !== '' && val !== false && val !== null && val !== undefined;
    })
  ).length;

  const groups = [...new Set(columns.map((c) => c.group).filter(Boolean))];
  const hasGroups = groups.length > 0;

  const renderInput = (col: Column, row: Record<string, any>, rowIndex: number) => {
    const baseClasses = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
    
    if (col.type === 'select') {
      return (
        <select
          value={row[col.key] || ''}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
          className={baseClasses}
        >
          <option value="">{col.placeholder || 'Select...'}</option>
          {col.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    
    if (col.type === 'checkbox') {
      return (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={row[col.key] || false}
            onChange={(e) => updateCell(rowIndex, col.key, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      );
    }
    
    if (col.type === 'number') {
      return (
        <input
          type="number"
          value={row[col.key] || ''}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
          placeholder={col.placeholder}
          className={baseClasses}
        />
      );
    }
    
    return (
      <input
        type="text"
        value={row[col.key] || ''}
        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
        placeholder={col.placeholder}
        className={baseClasses}
      />
    );
  };

  const renderGroupHeaders = () => {
    if (!hasGroups) return null;
    
    const groupSpans: { name: string; span: number }[] = [];
    let currentGroup = '';
    let currentSpan = 0;
    
    columns.forEach((col, i) => {
      const group = col.group || '';
      if (group !== currentGroup) {
        if (currentSpan > 0) {
          groupSpans.push({ name: currentGroup, span: currentSpan });
        }
        currentGroup = group;
        currentSpan = 1;
      } else {
        currentSpan++;
      }
      if (i === columns.length - 1) {
        groupSpans.push({ name: currentGroup, span: currentSpan });
      }
    });

    return (
      <tr className="bg-gray-100">
        <th className="px-2 py-1"></th>
        {groupSpans.map((g, i) => (
          <th
            key={i}
            colSpan={g.span}
            className={`px-2 py-1 text-xs font-semibold text-gray-600 text-center border-l border-gray-200 first:border-l-0 ${g.name ? 'bg-[var(--table-header-bg)]' : 'bg-card'}`}
          >
            {g.name}
          </th>
        ))}
      </tr>
    );
  };

  const tableContent = (
    <div className="space-y-4">
      <div className={`overflow-x-auto border border-gray-200 rounded-lg ${isExpanded ? 'max-h-[70vh]' : 'max-h-[500px]'} overflow-y-auto`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            {renderGroupHeaders()}
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-10 sticky left-0 bg-gray-50 z-20">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap"
                  style={{ minWidth: col.width || '120px' }}
                >
                  {col.header}
                  {col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-theme">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                <td className="px-2 py-1 text-xs text-gray-400 sticky left-0 bg-card z-10">{rowIndex + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className="px-1 py-1" style={{ minWidth: col.width || '120px' }}>
                    {renderInput(col, row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => addRows(5)}
            disabled={rows.length >= maxRows}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            + Add 5 rows
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={removeEmptyRows}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Remove empty
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Clear all
          </button>
          {!isExpanded && (
            <>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Expand
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{filledRowCount} rows to add</span>
          <Button onClick={handleSubmit} loading={submitting} disabled={filledRowCount === 0}>
            Add All
          </Button>
        </div>
      </div>

      {result && (
        <div className={`p-3 rounded-lg text-sm ${
          result.failed === 0 ? 'bg-green-50 text-green-700' : 
          result.success === 0 ? 'bg-red-50 text-red-700' : 
          'bg-yellow-50 text-yellow-700'
        }`}>
          {result.success > 0 && <span>✓ {result.success} added successfully. </span>}
          {result.failed > 0 && <span>✗ {result.failed} failed. </span>}
          {result.errors && result.errors.length > 0 && (
            <div className="mt-1 text-xs">
              {result.errors.slice(0, 5).map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
              {result.errors.length > 5 && <div>...and {result.errors.length - 5} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isExpanded) {
    return (
      <Modal
        isOpen={true}
        onClose={() => setIsExpanded(false)}
        title={title || 'Bulk Add'}
        size="full"
      >
        <div className="p-4">
          {tableContent}
        </div>
      </Modal>
    );
  }

  return tableContent;
}
