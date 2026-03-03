'use client';

import React from 'react';
import { Button } from '../ui/Button';

export interface ElectricalConfig {
  id?: string;
  voltage: number | '';
  voltageUnit: string;
  frequencyHz: number | '';
  amperage: string;
}

interface ElectricalConfigInputProps {
  configs: ElectricalConfig[];
  onChange: (configs: ElectricalConfig[]) => void;
}

const DEFAULT_CONFIG: ElectricalConfig = {
  voltage: '',
  voltageUnit: 'VAC',
  frequencyHz: '',
  amperage: '',
};

export function ElectricalConfigInput({ configs, onChange }: ElectricalConfigInputProps) {
  const handleAdd = () => {
    onChange([...configs, { ...DEFAULT_CONFIG }]);
  };

  const handleRemove = (index: number) => {
    onChange(configs.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof ElectricalConfig, value: string | number) => {
    const updated = configs.map((config, i) => {
      if (i === index) {
        return { ...config, [field]: value };
      }
      return config;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          + Add Option
        </Button>
      </div>
      
      {configs.length === 0 ? (
        <div className="text-sm text-gray-500 italic">
          No electrical configurations. Click &quot;Add Option&quot; to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Voltage</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={config.voltage}
                      onChange={(e) => handleChange(index, 'voltage', e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="240"
                      min="0"
                    />
                    <select
                      value={config.voltageUnit}
                      onChange={(e) => handleChange(index, 'voltageUnit', e.target.value)}
                      className="px-1 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="VAC">VAC</option>
                      <option value="VDC">VDC</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Frequency (Hz)</label>
                  <select
                    value={config.frequencyHz}
                    onChange={(e) => handleChange(index, 'frequencyHz', e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    <option value="50">50 Hz</option>
                    <option value="60">60 Hz</option>
                  </select>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Amperage</label>
                  <input
                    type="text"
                    value={config.amperage}
                    onChange={(e) => handleChange(index, 'amperage', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="40A, 50A, 1x32A"
                  />
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      
      <p className="text-xs text-gray-500">
        Add multiple electrical options for different configurations (e.g., 240V @ 40A or 50A, 230VAC 50Hz 1x32A).
      </p>
    </div>
  );
}
