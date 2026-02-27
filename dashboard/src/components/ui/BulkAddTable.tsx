'use client';

import React, { useState } from 'react';
import { Button } from './Button';

interface Column {
  key: string;
  header: string;
  type?: 'text' | 'number' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  width?: string;
}

interface BulkAddTableProps {
  columns: Column[];
  onSubmit: (rows: Record<string, any>[]) => Promise<{ success: number; failed: number; errors?: string[] }>;
  minRows?: number;
  maxRows?: number;
}

export function BulkAddTable({ columns, onSubmit, minRows = 5, maxRows = 50 }: BulkAddTableProps) {
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

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-10">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left text-xs font-medium text-gray-500"
                  style={{ width: col.width }}
                >
                  {col.header}
                  {col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                <td className="px-2 py-1 text-xs text-gray-400">{rowIndex + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className="px-1 py-1">
                    {col.type === 'select' ? (
                      <select
                        value={row[col.key] || ''}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">{col.placeholder || 'Select...'}</option>
                        {col.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : col.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={row[col.key] || false}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    ) : col.type === 'number' ? (
                      <input
                        type="number"
                        value={row[col.key] || ''}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={row[col.key] || ''}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            Remove empty rows
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Clear all
          </button>
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
}
