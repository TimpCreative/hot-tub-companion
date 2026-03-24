'use client';

import { useState, useRef, useEffect } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type ImportType = 'brands' | 'model-lines' | 'spas' | 'parts' | 'comps';

interface TemplateResponse {
  headers: string[];
  example: string[];
}

interface ImportResult {
  created: number;
  updated?: number;
  skipped: number;
  compatibilityCreated?: number;
  categoriesAutoCreated?: number;
  brandsAutoCreated?: number;
  modelLinesAutoCreated?: number;
  spasAutoCreated?: number;
  errors: string[];
}

export default function ImportPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [importType, setImportType] = useState<ImportType>('brands');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [autoCreate, setAutoCreate] = useState(false);
  const [spaTemplate, setSpaTemplate] = useState<TemplateResponse | null>(null);
  const [partsTemplate, setPartsTemplate] = useState<TemplateResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWithAuth('/api/dashboard/super-admin/import/templates/spas')
      .then((res) => res.json())
      .then((data) => data.success && data.data && setSpaTemplate(data.data))
      .catch(() => {});
    fetchWithAuth('/api/dashboard/super-admin/import/templates/parts')
      .then((res) => res.json())
      .then((data) => data.success && data.data && setPartsTemplate(data.data))
      .catch(() => {});
  }, [fetchWithAuth]);

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

      const res = await fetchWithAuth(`/api/dashboard/super-admin/import/${importType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, autoCreate }),
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

  const staticTemplates: Record<ImportType, { headers: string[]; example: string[]; label: string; description: string }> = {
    brands: {
      headers: ['name', 'logoUrl', 'websiteUrl', 'dataSource'],
      example: ['Jacuzzi', 'https://example.com/logo.png', 'https://jacuzzi.com', 'manual_entry'],
      label: 'Brands',
      description: 'Spa brands',
    },
    'model-lines': {
      headers: ['brandName', 'name', 'description', 'dataSource'],
      example: ['Jacuzzi', 'J-300 Collection', 'Mid-range hot tubs', 'manual_entry'],
      label: 'Model Lines',
      description: 'Brand model lines',
    },
    comps: {
      headers: ['partNumber', 'partName', 'brandName', 'modelLineName', 'spaName', 'spaYear', 'compId', 'fitNotes', 'dataSource'],
      example: ['PKG-12345', '', 'Jacuzzi', 'J-300', 'J-345', '2024', '', 'OEM filter', 'manual_entry'],
      label: 'Comps',
      description: 'Part-spa compatibility',
    },
    spas: {
      headers: spaTemplate?.headers ?? ['brandName', 'modelLineName', 'name', 'year', 'manufacturerSku', 'seatingCapacity', 'jetCount', 'waterCapacityGallons', 'dimensionsLengthInches', 'dimensionsWidthInches', 'dimensionsHeightInches', 'weightDryLbs', 'weightFilledLbs', 'imageUrl', 'specSheetUrl', 'notes', 'isDiscontinued', 'dataSource'],
      example: spaTemplate?.example ?? ['Jacuzzi', 'J-300 Collection', 'J-335', '2024', 'JAC-J335-24', '5', '35', '350', '85', '85', '36', '725', '4200', '', '', '', 'false', 'manual_entry'],
      label: 'Spas',
      description: 'Spa model-years',
    },
    parts: {
      headers: partsTemplate?.headers ?? [
        'name', 'categoryName', 'partNumber', 'manufacturerSku', 'upc', 'ean', 'skuAliases',
        'manufacturer', 'isOem', 'isUniversal', 'isDiscontinued', 'displayImportance',
        'imageUrl', 'specSheetUrl', 'notes', 'dataSource',
        'compatibleBrands', 'compatibleModelLines', 'compatibleSpas', 'compatibleYears'
      ],
      example: partsTemplate?.example ?? [
        'ProClarity Filter', 'filters', 'PKG-12345', 'JAC-FILTER-001', '012345678901', '', 'PKG12345, FILTER-001',
        'Jacuzzi', 'true', 'false', 'false', '2',
        '', '', '', 'manual_entry',
        'Jacuzzi, Hot Spring', 'J-300, Limelight', 'J-335, J-345', '2020-2024'
      ],
      label: 'Parts',
      description: 'Parts catalog with compatibility',
    },
  };

  const templates = staticTemplates;

  const escapeCsvValue = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const downloadTemplate = () => {
    const template = templates[importType];
    const headerRow = template.headers.join(',');
    const exampleRow = template.example.map(escapeCsvValue).join(',');
    const csv = [headerRow, exampleRow].join('\n');
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
          <div className="card rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Type</h3>
            <div className="grid grid-cols-5 gap-3">
              {(['brands', 'model-lines', 'spas', 'parts', 'comps'] as ImportType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setImportType(type);
                    setCsvPreview([]);
                    setResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    importType === type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{templates[type].label}</div>
                  <div className="text-xs text-gray-500 mt-1">{templates[type].description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card rounded-lg p-6">
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

            {['model-lines', 'spas', 'parts'].includes(importType) && (
              <label className="flex items-center gap-2 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-amber-900">
                    Auto-create missing entities
                  </span>
                  <p className="text-xs text-amber-700">
                    {importType === 'parts' 
                      ? 'Create categories, brands, model lines, and spas if they don\'t exist'
                      : importType === 'spas'
                      ? 'Create brands and model lines if they don\'t exist'
                      : 'Create brands if they don\'t exist'}
                  </p>
                </div>
              </label>
            )}

            <Button
              onClick={handleImport}
              loading={loading}
              disabled={csvPreview.length === 0}
              className="w-full mt-4"
            >
              Import {templates[importType].label}
            </Button>
          </div>

          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
              }`}
            >
              <h4 className="font-medium text-gray-900 mb-2">Import Results</h4>
              <div className="flex flex-wrap gap-4 mb-3">
                <div>
                  <span className="text-2xl font-bold text-green-600">{result.created}</span>
                  <span className="text-sm text-gray-500 ml-1">created</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-400">{result.skipped}</span>
                  <span className="text-sm text-gray-500 ml-1">skipped</span>
                </div>
                {result.updated !== undefined && result.updated > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-yellow-600">{result.updated}</span>
                    <span className="text-sm text-gray-500 ml-1">existing found</span>
                  </div>
                )}
                {result.compatibilityCreated !== undefined && result.compatibilityCreated > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-blue-600">{result.compatibilityCreated}</span>
                    <span className="text-sm text-gray-500 ml-1">compatibility records</span>
                  </div>
                )}
              </div>
              {((result.categoriesAutoCreated && result.categoriesAutoCreated > 0) ||
                (result.brandsAutoCreated && result.brandsAutoCreated > 0) || 
                (result.modelLinesAutoCreated && result.modelLinesAutoCreated > 0) || 
                (result.spasAutoCreated && result.spasAutoCreated > 0)) && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                  <h5 className="text-sm font-medium text-amber-800 mb-1">Auto-created:</h5>
                  <div className="flex flex-wrap gap-4 text-sm text-amber-700">
                    {result.categoriesAutoCreated && result.categoriesAutoCreated > 0 && (
                      <span>{result.categoriesAutoCreated} categor{result.categoriesAutoCreated !== 1 ? 'ies' : 'y'}</span>
                    )}
                    {result.brandsAutoCreated && result.brandsAutoCreated > 0 && (
                      <span>{result.brandsAutoCreated} brand{result.brandsAutoCreated !== 1 ? 's' : ''}</span>
                    )}
                    {result.modelLinesAutoCreated && result.modelLinesAutoCreated > 0 && (
                      <span>{result.modelLinesAutoCreated} model line{result.modelLinesAutoCreated !== 1 ? 's' : ''}</span>
                    )}
                    {result.spasAutoCreated && result.spasAutoCreated > 0 && (
                      <span>{result.spasAutoCreated} spa{result.spasAutoCreated !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              )}
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

          {importType === 'parts' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2">Smart Compatibility Columns</h3>
                <p className="text-sm text-purple-800 mb-2">
                  Assign compatibility using four separate columns that work as filters:
                </p>
                <div className="text-sm text-purple-800 space-y-1">
                  <div><strong>compatibleBrands</strong> - Brand names (comma-separated)</div>
                  <div><strong>compatibleModelLines</strong> - Model line names only</div>
                  <div><strong>compatibleSpas</strong> - Spa model names only</div>
                  <div><strong>compatibleYears</strong> - Years or year ranges</div>
                </div>
                <p className="text-xs text-purple-700 mt-2">
                  Columns narrow progressively: brands → model lines → spas → years
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Column Formats</h3>
                <div className="text-sm text-blue-800 space-y-3">
                  <div>
                    <strong>compatibleBrands</strong><br />
                    <code className="bg-blue-100 px-1 rounded">Jacuzzi, Hot Spring</code>
                  </div>
                  <div>
                    <strong>compatibleModelLines</strong><br />
                    <code className="bg-blue-100 px-1 rounded">J-300, Limelight</code>
                  </div>
                  <div>
                    <strong>compatibleSpas</strong><br />
                    <code className="bg-blue-100 px-1 rounded">J-335, J-345</code>
                  </div>
                  <div>
                    <strong>compatibleYears</strong><br />
                    <code className="bg-blue-100 px-1 rounded">2020-2024</code> or <code className="bg-blue-100 px-1 rounded">2020, 2022, 2024</code>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Example Scenarios</h3>
                <ul className="text-sm text-yellow-800 space-y-2">
                  <li>
                    <strong>All brand spas:</strong> <code className="bg-yellow-100 px-1 rounded">compatibleBrands=Jacuzzi</code>
                  </li>
                  <li>
                    <strong>Model line + years:</strong> <code className="bg-yellow-100 px-1 rounded">compatibleBrands=Jacuzzi</code>, <code className="bg-yellow-100 px-1 rounded">compatibleModelLines=J-300</code>, <code className="bg-yellow-100 px-1 rounded">compatibleYears=2020-2024</code>
                  </li>
                  <li>
                    <strong>Specific spas:</strong> <code className="bg-yellow-100 px-1 rounded">compatibleBrands=Jacuzzi</code>, <code className="bg-yellow-100 px-1 rounded">compatibleModelLines=J-300</code>, <code className="bg-yellow-100 px-1 rounded">compatibleSpas=J-335</code>, <code className="bg-yellow-100 px-1 rounded">compatibleYears=2020-2022</code>
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">Continuation Rows</h3>
                <p className="text-sm text-green-800 mb-2">
                  For complex compatibility, use continuation rows. Rows without part info (name, categoryName) add more compatibility to the previous part:
                </p>
                <div className="text-xs font-mono text-green-700 bg-green-100 p-2 rounded overflow-x-auto">
                  <div>name,partNumber,categoryName,compatibleBrands,compatibleModelLines,compatibleSpas,compatibleYears</div>
                  <div>Filter XL,FLT-001,filters,Jacuzzi,J-300,J-335,2020-2022</div>
                  <div>,,,,J-300,J-345,2021-2024</div>
                  <div>,,,Hot Spring,Highlife,Envoy,2019-2023</div>
                </div>
                <p className="text-xs text-green-700 mt-2">Row 1 creates the part. Rows 2-3 add more compatibility.</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">All Parts Columns (20)</h3>
                <div className="text-xs font-mono text-gray-600 grid grid-cols-2 gap-1">
                  <div>• name <span className="text-red-500">*</span></div>
                  <div>• categoryName <span className="text-red-500">*</span></div>
                  <div>• partNumber</div>
                  <div>• manufacturerSku</div>
                  <div>• upc</div>
                  <div>• ean</div>
                  <div>• skuAliases</div>
                  <div>• manufacturer</div>
                  <div>• isOem</div>
                  <div>• isUniversal</div>
                  <div>• isDiscontinued</div>
                  <div>• displayImportance</div>
                  <div>• imageUrl</div>
                  <div>• specSheetUrl</div>
                  <div>• notes</div>
                  <div>• dataSource</div>
                  <div className="col-span-2 mt-2 border-t pt-2">
                    <strong>Compatibility (optional):</strong>
                  </div>
                  <div>• compatibleBrands</div>
                  <div>• compatibleModelLines</div>
                  <div>• compatibleSpas</div>
                  <div>• compatibleYears</div>
                </div>
                <p className="text-xs text-gray-500 mt-2"><span className="text-red-500">*</span> = required (except for continuation rows)</p>
              </div>
            </div>
          )}

          {importType === 'comps' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2">What is Compatibility Import?</h3>
                <p className="text-sm text-purple-800 mb-2">
                  This imports part-spa relationships from a spreadsheet. Use it when you have manufacturer data
                  showing which parts fit which spas (e.g., &quot;Filter X fits J-300 Series 2020-2024&quot;).
                </p>
                <p className="text-sm text-purple-800">
                  Each row creates a link between a part and a spa model-year. All imported records start
                  as <Badge variant="warning" size="sm">pending</Badge> for review.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Two Import Methods</h3>
                <div className="text-sm text-yellow-800 space-y-3">
                  <div>
                    <strong>Method 1: Individual Spas</strong><br />
                    Fill <code className="bg-yellow-100 px-1 rounded">brandName</code>,{' '}
                    <code className="bg-yellow-100 px-1 rounded">modelLineName</code>,{' '}
                    <code className="bg-yellow-100 px-1 rounded">spaName</code>, and{' '}
                    <code className="bg-yellow-100 px-1 rounded">spaYear</code>.
                    Leave <code className="bg-yellow-100 px-1 rounded">compId</code> empty.
                  </div>
                  <div>
                    <strong>Method 2: Using Comp Groups</strong><br />
                    Fill <code className="bg-yellow-100 px-1 rounded">compId</code> to assign a part to ALL spas
                    in that Compatibility Group. Leave brand/model columns empty.
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-2">Important Rules</h3>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Each row must use ONE method only (spa details OR compId, not both)</li>
                  <li>• Rows with both compId AND spa details will be rejected</li>
                  <li>• Parts must exist in the database (by partNumber or partName)</li>
                  <li>• Spas/Comps must exist in the database</li>
                  <li>• Use <code className="bg-red-100 px-1 rounded">spaName</code> and <code className="bg-red-100 px-1 rounded">spaYear</code> (not modelName/modelYear)</li>
                </ul>
              </div>
            </div>
          )}

          <div className="card rounded-lg p-4">
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
