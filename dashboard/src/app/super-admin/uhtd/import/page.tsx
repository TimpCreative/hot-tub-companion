'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type ImportType = 'brands' | 'parts' | 'compatibility';

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('brands');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter((line) => line.trim());
    return lines.map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvPreview(parsed.slice(0, 6));
      setResult(null);
    };
    reader.readAsText(file);
  };

  const csvToRows = (csv: string[][]): Record<string, unknown>[] => {
    if (csv.length < 2) return [];
    const headers = csv[0];
    return csv.slice(1).map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        let value: unknown = row[i] || '';
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value as string)) value = parseInt(value as string);
        obj[header] = value;
      });
      return obj;
    });
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      const rows = csvToRows(parsed);

      const res = await fetch(`/api/dashboard/super-admin/import/${importType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setResult({ created: 0, skipped: 0, errors: [data.error?.message || 'Import failed'] });
      }
    } catch (err: any) {
      setResult({ created: 0, skipped: 0, errors: [err.message] });
    } finally {
      setLoading(false);
    }
  };

  const templates: Record<ImportType, { headers: string[]; example: string[] }> = {
    brands: {
      headers: ['name', 'logoUrl', 'websiteUrl', 'dataSource'],
      example: ['Jacuzzi', 'https://example.com/logo.png', 'https://jacuzzi.com', 'manual_entry'],
    },
    parts: {
      headers: ['name', 'categoryName', 'partNumber', 'upc', 'manufacturer', 'isOem', 'isUniversal', 'dataSource'],
      example: ['ProClarity Filter', 'filters', 'PKG-12345', '012345678901', 'Jacuzzi', 'true', 'false', 'manual_entry'],
    },
    compatibility: {
      headers: ['partNumber', 'partName', 'brandName', 'modelLineName', 'modelName', 'modelYear', 'compId', 'fitNotes', 'dataSource'],
      example: ['PKG-12345', '', 'Jacuzzi', 'J-300', 'J-345', '2024', '', 'OEM filter', 'manual_entry'],
    },
  };

  const downloadTemplate = () => {
    const template = templates[importType];
    const csv = [template.headers.join(','), template.example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Bulk Import</h1>
        <p className="text-sm text-gray-500 mt-1">Import data from CSV files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Type</h3>
            <div className="grid grid-cols-3 gap-4">
              {(['brands', 'parts', 'compatibility'] as ImportType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setImportType(type);
                    setCsvPreview([]);
                    setResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    importType === type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 capitalize">{type}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {type === 'brands' && 'Spa brands'}
                    {type === 'parts' && 'Parts catalog'}
                    {type === 'compatibility' && 'Part-spa links'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload CSV</h3>
              <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <svg
                  className="w-12 h-12 text-gray-400 mb-3"
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
                <span className="text-gray-600">Click to select CSV file</span>
                <span className="text-xs text-gray-400 mt-1">or drag and drop</span>
              </label>
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Preview</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {csvPreview[0].map((header, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium text-gray-500">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(1).map((row, ri) => (
                        <tr key={ri} className="border-t border-gray-100">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 text-gray-600 truncate max-w-32">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              loading={loading}
              disabled={csvPreview.length === 0}
              className="w-full mt-4"
            >
              Import {importType}
            </Button>
          </div>

          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
              }`}
            >
              <h4 className="font-medium text-gray-900 mb-2">Import Results</h4>
              <div className="flex gap-4 mb-3">
                <div>
                  <span className="text-2xl font-bold text-green-600">{result.created}</span>
                  <span className="text-sm text-gray-500 ml-1">created</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-400">{result.skipped}</span>
                  <span className="text-sm text-gray-500 ml-1">skipped</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-red-700 mb-1">Errors:</h5>
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Import Tips</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Download the template to see required columns</li>
              <li>• First row must be column headers</li>
              <li>• Duplicates are automatically skipped</li>
              <li>• Compatibility imports create "pending" records</li>
            </ul>
          </div>

          {importType === 'compatibility' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2">Comp ID Shortcut</h3>
              <p className="text-sm text-yellow-800">
                Use the <code className="bg-yellow-100 px-1 rounded">compId</code> column to assign
                a part to all spas in a Compatibility Group at once. Leave brandName/modelLineName/modelName/modelYear empty when using compId.
              </p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Expected Columns</h3>
            <div className="text-xs font-mono text-gray-600 space-y-1">
              {templates[importType].headers.map((header) => (
                <div key={header}>• {header}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
