/**
 * Advanced Custom Columns & Properties Manager
 * Sophisticated UI for customizing group data tracking
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { 
  CustomColumn, 
  GroupCustomSchema, 
} from '@/app/types/custom-columns';

interface CustomColumnsManagerProps {
  groupId: string;
  groupName: string;
  currentSchema?: GroupCustomSchema;
  onSchemaChange: (schema: GroupCustomSchema) => void;
  onSave: (schema: GroupCustomSchema) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

// Helper function to create default schema
function createDefaultSchema(groupId: string): GroupCustomSchema {
  return {
    id: `schema-${groupId}`,
    groupId,
    name: 'Default Schema',
    description: 'Default column configuration',
    columns: [],
    globalProperties: [],
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    lastModifiedBy: 'system'
  };
}

export function CustomColumnsManager({
  groupId,
  groupName,
  currentSchema,
  onSchemaChange,
  onSave,
  onCancel,
  className = ''
}: CustomColumnsManagerProps) {
  // State management
  const [schema, setSchema] = useState<GroupCustomSchema>(
    currentSchema || createDefaultSchema(groupId)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'type' | 'modified'>('order');
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInactiveColumns] = useState(false);

  // Memoized filtered and sorted columns
  const filteredColumns = useMemo(() => {
    const filtered = schema.columns.filter(col => {
      if (!showInactiveColumns && !col.isActive) return false;
      
      const matchesSearch = col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          col.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || 
                            col.dataType === filterCategory ||
                            (col.template && col.template.category === filterCategory);
      
      return matchesSearch && matchesCategory;
    });

    // Sort columns
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.dataType.localeCompare(b.dataType);
        case 'modified':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'order':
        default:
          return a.order - b.order;
      }
    });

    return filtered;
  }, [schema.columns, searchTerm, filterCategory, sortBy, showInactiveColumns]);

  // Effect to notify parent of schema changes
  useEffect(() => {
    onSchemaChange(schema);
  }, [schema, onSchemaChange]);

  // Handle column reordering
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(schema.columns);
    const reorderedItem = items.splice(result.source.index, 1)[0];
    
    if (reorderedItem) {
      items.splice(result.destination.index, 0, reorderedItem);
    }

    // Update order property for all columns
    const reorderedColumns = items.map((col, index) => ({
      ...col,
      order: index + 1,
      updatedAt: new Date()
    }));
    
    setSchema(prev => ({
      ...prev,
      columns: reorderedColumns,
      updatedAt: new Date()
    }));
  }, [schema.columns]);

  const handleColumnDelete = useCallback((columnId: string) => {
    setSchema(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col.id !== columnId),
      updatedAt: new Date()
    }));
    
    setIsDirty(true);
  }, []);

  const handleColumnToggle = useCallback((columnId: string) => {
    setSchema(prev => ({
      ...prev,
      columns: prev.columns.map(col => 
        col.id === columnId ? { ...col, isActive: !col.isActive, updatedAt: new Date() } : col
      ),
      updatedAt: new Date()
    }));
    
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSave(schema);
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving schema:', error);
      setValidationErrors(['Failed to save schema. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  }, [schema, onSave]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div className={`custom-columns-manager ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Custom Columns & Properties
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure custom data fields for {groupName}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Preview feature coming soon!')}
            className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <EyeIcon className="w-4 h-4 mr-2" />
            Preview
          </button>
          
          <button
            onClick={() => alert('Add Column feature coming soon!')}
            className="flex items-center px-3 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Column
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              Validation Errors
            </span>
          </div>
          <ul className="mt-2 text-sm text-red-700 dark:text-red-300">
            {validationErrors.map((error, index) => (
              <li key={index} className="list-disc list-inside">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="currency">Currency</option>
            <option value="date">Date</option>
            <option value="boolean">Boolean</option>
            <option value="select">Select</option>
            <option value="calculated">Calculated</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="order">Order</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="modified">Modified</option>
          </select>
        </div>
      </div>

      {/* Columns List */}
      <div className="space-y-4">
        {filteredColumns.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No columns found. Add some columns to get started!</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {filteredColumns.map((column, index) => (
                    <Draggable key={column.id} draggableId={column.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          } ${!column.isActive ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                  {column.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {column.description}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                                {column.dataType}
                              </span>
                              
                              <button
                                onClick={() => handleColumnToggle(column.id)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                {column.isActive ? (
                                  <EyeIcon className="w-4 h-4" />
                                ) : (
                                  <EyeSlashIcon className="w-4 h-4" />
                                )}
                              </button>
                              
                              <button
                                onClick={() => alert('Edit feature coming soon!')}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => alert('Duplicate feature coming soon!')}
                                className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200"
                              >
                                <DocumentDuplicateIcon className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this column?')) {
                                    handleColumnDelete(column.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 flex justify-end gap-4">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Schema'}
        </button>
      </div>
    </div>
  );
}
