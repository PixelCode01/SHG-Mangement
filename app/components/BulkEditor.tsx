/**
 * Bulk Editor Component
 * For editing multiple columns at once
 */

'use client';

import React, { useState } from 'react';
import { CustomColumn } from '@/app/types/custom-columns';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface BulkEditorProps {
  columns: CustomColumn[];
  onSave: (columns: CustomColumn[]) => void;
  onClose: () => void;
}

export function BulkEditor({ columns, onSave, onClose }: BulkEditorProps) {
  const [editedColumns, setEditedColumns] = useState<CustomColumn[]>(columns);

  const handleSave = () => {
    onSave(editedColumns);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Bulk Edit Columns
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="space-y-4">
            {editedColumns.map((column, index) => (
              <div key={column.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{column.name}</h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{column.type}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={column.name}
                      onChange={(e) => {
                        const newColumns = [...editedColumns];
                        newColumns[index] = { ...column, name: e.target.value };
                        setEditedColumns(newColumns);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={column.description || ''}
                      onChange={(e) => {
                        const newColumns = [...editedColumns];
                        newColumns[index] = { ...column, description: e.target.value };
                        setEditedColumns(newColumns);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={column.isActive}
                        onChange={(e) => {
                          const newColumns = [...editedColumns];
                          newColumns[index] = { ...column, isActive: e.target.checked };
                          setEditedColumns(newColumns);
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={column.isRequired}
                        onChange={(e) => {
                          const newColumns = [...editedColumns];
                          newColumns[index] = { ...column, isRequired: e.target.checked };
                          setEditedColumns(newColumns);
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
