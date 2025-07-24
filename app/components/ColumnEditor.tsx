/**
 * Advanced Column Editor Component
 * Comprehensive interface for creating and editing custom columns
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

import {
  CustomColumn,
  ColumnDataType,
  ColumnProperty,
  ColumnFormula,
  GroupCustomSchema
} from '@/app/types/custom-columns';
import { FormulaBuilder } from './FormulaBuilder';
import { PropertyEditor } from './PropertyEditor';

// Validation schema for column editor
const columnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(50, 'Column name must be 50 characters or less'),
  description: z.string().max(200, 'Description must be 200 characters or less').optional(),
  dataType: z.enum(['number', 'currency', 'percentage', 'text', 'date', 'boolean', 'dropdown', 'calculated', 'property-driven']),
  isActive: z.boolean(),
  displayConfig: z.object({
    showInTable: z.boolean(),
    showInSummary: z.boolean(),
    showInReports: z.boolean(),
    width: z.number().min(50).max(500).optional(),
    alignment: z.enum(['left', 'center', 'right']),
    aggregateType: z.enum(['sum', 'average', 'count', 'none']),
    formatType: z.enum(['currency', 'percentage', 'number', 'text', 'date']),
    decimalPlaces: z.number().min(0).max(10),
    prefix: z.string().max(10).optional(),
    suffix: z.string().max(10).optional()
  }),
  validation: z.object({
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customRule: z.string().optional()
  }),
  permissions: z.object({
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canReorder: z.boolean(),
    adminOnly: z.boolean()
  })
});

type ColumnFormData = z.infer<typeof columnSchema>;

interface ColumnEditorProps {
  column?: CustomColumn;
  schema: GroupCustomSchema;
  onSave: (column: CustomColumn) => void;
  onClose: () => void;
}

export function ColumnEditor({ column, schema, onSave, onClose }: ColumnEditorProps) {
  const isEditing = !!column;
  const [activeTab, setActiveTab] = useState<'basic' | 'properties' | 'formula' | 'display' | 'validation'>('basic');
  const [properties, setProperties] = useState<ColumnProperty[]>(column?.properties || []);
  const [formula, setFormula] = useState<ColumnFormula | undefined>(column?.formula);
  const [dropdownOptions, setDropdownOptions] = useState<{ value: string; label: string; color?: string }[]>(
    column?.dropdownOptions || []
  );
  const [_previewData, _setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<ColumnFormData>({
    resolver: zodResolver(columnSchema),
    defaultValues: {
      name: column?.name || '',
      description: column?.description || '',
      dataType: column?.dataType || 'text',
      isActive: column?.isActive ?? true,
      displayConfig: {
        showInTable: column?.displayConfig.showInTable ?? true,
        showInSummary: column?.displayConfig.showInSummary ?? false,
        showInReports: column?.displayConfig.showInReports ?? true,
        width: column?.displayConfig.width,
        alignment: column?.displayConfig.alignment || 'left',
        aggregateType: column?.displayConfig.aggregateType || 'none',
        formatType: column?.displayConfig.formatType || 'text',
        decimalPlaces: column?.displayConfig.decimalPlaces || 2,
        prefix: column?.displayConfig.prefix || '',
        suffix: column?.displayConfig.suffix || ''
      },
      validation: {
        required: column?.validation.required ?? false,
        min: column?.validation.min,
        max: column?.validation.max,
        pattern: column?.validation.pattern || '',
        customRule: column?.validation.customRule || ''
      },
      permissions: {
        canEdit: column?.permissions.canEdit ?? true,
        canDelete: column?.permissions.canDelete ?? true,
        canReorder: column?.permissions.canReorder ?? true,
        adminOnly: column?.permissions.adminOnly ?? false
      }
    }
  });

  const dataType = watch('dataType');
  const formatType = watch('displayConfig.formatType');

  // Update format type when data type changes
  useEffect(() => {
    const formatMap: Record<ColumnDataType, string> = {
      'currency': 'currency',
      'percentage': 'percentage',
      'number': 'number',
      'date': 'date',
      'text': 'text',
      'boolean': 'text',
      'dropdown': 'text',
      'calculated': 'number',
      'property-driven': 'number'
    };
    
    if (formatMap[dataType] !== formatType) {
      setValue('displayConfig.formatType', formatMap[dataType] as 'currency' | 'percentage' | 'number' | 'text' | 'date');
    }
  }, [dataType, formatType, setValue]);

  // Validate configuration
  useEffect(() => {
    const errors: string[] = [];
    
    // Validate based on data type
    if (dataType === 'dropdown' && dropdownOptions.length === 0) {
      errors.push('Dropdown columns must have at least one option');
    }
    
    if (dataType === 'calculated' && !formula) {
      errors.push('Calculated columns must have a formula');
    }
    
    if (dataType === 'property-driven' && properties.length === 0) {
      errors.push('Property-driven columns must have at least one property');
    }
    
    // Validate formula if present
    if (formula) {
      const referencedColumns = formula.referencedColumns;
      const existingColumns = schema.columns.map(col => col.id);
      const missingColumns = referencedColumns.filter(id => !existingColumns.includes(id) && id !== column?.id);
      
      if (missingColumns.length > 0) {
        errors.push(`Formula references missing columns: ${missingColumns.join(', ')}`);
      }
    }
    
    setValidationErrors(errors);
  }, [dataType, dropdownOptions, formula, properties, schema.columns, column?.id]);

  const handleSave = useCallback((data: ColumnFormData) => {
    if (validationErrors.length > 0) {
      alert('Please fix validation errors before saving.');
      return;
    }

    const newColumn: CustomColumn = {
      id: column?.id || `col-${Date.now()}`,
      name: data.name,
      description: data.description,
      dataType: data.dataType,
      order: column?.order || Math.max(...schema.columns.map(col => col.order), 0) + 1,
      isActive: data.isActive,
      templateId: column?.templateId,
      template: column?.template,
      properties: properties,
      formula: formula,
      dropdownOptions: dataType === 'dropdown' ? dropdownOptions : undefined,
      displayConfig: data.displayConfig,
      validation: data.validation,
      permissions: data.permissions,
      createdAt: column?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: column?.createdBy || 'current-user',
      lastModifiedBy: 'current-user'
    };

    onSave(newColumn);
  }, [column, schema.columns, properties, formula, dropdownOptions, dataType, validationErrors, onSave]);

  const handleAddProperty = useCallback(() => {
    const newProperty: ColumnProperty = {
      id: `prop-${Date.now()}`,
      name: '',
      type: 'fixed-amount',
      value: 0,
      description: ''
    };
    setProperties(prev => [...prev, newProperty]);
  }, []);

  const handleUpdateProperty = useCallback((propertyId: string, updates: Partial<ColumnProperty>) => {
    setProperties(prev => prev.map(prop => 
      prop.id === propertyId ? { ...prop, ...updates } : prop
    ));
  }, []);

  const handleDeleteProperty = useCallback((propertyId: string) => {
    setProperties(prev => prev.filter(prop => prop.id !== propertyId));
  }, []);

  const handleAddDropdownOption = useCallback(() => {
    const newOption = {
      value: '',
      label: '',
      color: '#3B82F6'
    };
    setDropdownOptions(prev => [...prev, newOption]);
  }, []);

  const handleUpdateDropdownOption = useCallback((index: number, updates: Partial<{ value: string; label: string; color: string }>) => {
    setDropdownOptions(prev => prev.map((option, i) => 
      i === index ? { ...option, ...updates } : option
    ));
  }, []);

  const handleDeleteDropdownOption = useCallback((index: number) => {
    setDropdownOptions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const generatePreview = useCallback(() => {
    // Generate sample data for preview
    const sampleData = {
      memberName: 'John Doe',
      loanAmount: 50000,
      contributionAmount: 500,
      familyMembersCount: 4,
      meetingDate: new Date(),
      // Add more sample data as needed
    };
    
    // For now, just store the preview data (removed console.log for production build)
    _setPreviewData(sampleData);
  }, [_setPreviewData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isEditing ? 'Edit Column' : 'Add New Column'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure your custom column properties and behavior
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2" />
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                Please fix the following errors:
              </h3>
            </div>
            <ul className="mt-2 text-sm text-red-700 dark:text-red-300">
              {validationErrors.map((error, index) => (
                <li key={index} className="ml-4">• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-600">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'basic', label: 'Basic Info', icon: InformationCircleIcon },
              { key: 'properties', label: 'Properties', icon: Cog6ToothIcon },
              { key: 'formula', label: 'Formula', icon: CodeBracketIcon },
              { key: 'display', label: 'Display', icon: EyeIcon },
              { key: 'validation', label: 'Validation', icon: CheckCircleIcon }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'basic' | 'properties' | 'formula' | 'display' | 'validation')}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Column Name <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Enter column name"
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Describe what this column tracks"
                      />
                    )}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Type <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="dataType"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="percentage">Percentage</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean (Yes/No)</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="calculated">Calculated</option>
                        <option value="property-driven">Property-Driven</option>
                      </select>
                    )}
                  />
                </div>

                <div>
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          {...field}
                          checked={field.value}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Active (show in tables and reports)
                        </span>
                      </label>
                    )}
                  />
                </div>

                {/* Dropdown Options */}
                {dataType === 'dropdown' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dropdown Options
                    </label>
                    <div className="space-y-2">
                      {dropdownOptions.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={option.value}
                            onChange={(e) => handleUpdateDropdownOption(index, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                          />
                          <input
                            type="text"
                            value={option.label}
                            onChange={(e) => handleUpdateDropdownOption(index, { label: e.target.value })}
                            placeholder="Display Label"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                          />
                          <input
                            type="color"
                            value={option.color || '#3B82F6'}
                            onChange={(e) => handleUpdateDropdownOption(index, { color: e.target.value })}
                            className="w-10 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteDropdownOption(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddDropdownOption}
                        className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add Option
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Properties Tab */}
            {activeTab === 'properties' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Column Properties
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddProperty}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Property
                  </button>
                </div>

                {properties.length === 0 ? (
                  <div className="text-center py-8">
                    <Cog6ToothIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No properties configured. Add properties to make this column dynamic.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {properties.map((property, index) => (
                      <PropertyEditor
                        key={property.id}
                        property={property}
                        index={index}
                        onUpdate={(updates) => handleUpdateProperty(property.id, updates)}
                        onDelete={() => handleDeleteProperty(property.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Formula Tab */}
            {activeTab === 'formula' && (
              <div className="space-y-4">
                <FormulaBuilder
                  formula={formula}
                  availableColumns={schema.columns}
                  availableProperties={[...schema.globalProperties, ...properties]}
                  onChange={setFormula}
                />
              </div>
            )}

            {/* Display Tab */}
            {activeTab === 'display' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Controller
                      name="displayConfig.showInTable"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Show in table
                          </span>
                        </label>
                      )}
                    />
                  </div>
                  <div>
                    <Controller
                      name="displayConfig.showInSummary"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Show in summary
                          </span>
                        </label>
                      )}
                    />
                  </div>
                  <div>
                    <Controller
                      name="displayConfig.showInReports"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Show in reports
                          </span>
                        </label>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alignment
                    </label>
                    <Controller
                      name="displayConfig.alignment"
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Aggregate Type
                    </label>
                    <Controller
                      name="displayConfig.aggregateType"
                      control={control}
                      render={({ field }) => (
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="none">None</option>
                          <option value="sum">Sum</option>
                          <option value="average">Average</option>
                          <option value="count">Count</option>
                        </select>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Decimal Places
                    </label>
                    <Controller
                      name="displayConfig.decimalPlaces"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          min="0"
                          max="10"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Prefix
                    </label>
                    <Controller
                      name="displayConfig.prefix"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g., ₹"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Suffix
                    </label>
                    <Controller
                      name="displayConfig.suffix"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g., %"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Validation Tab */}
            {activeTab === 'validation' && (
              <div className="space-y-4">
                <div>
                  <Controller
                    name="validation.required"
                    control={control}
                    render={({ field }) => (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          {...field}
                          checked={field.value}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Required field
                        </span>
                      </label>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum Value
                    </label>
                    <Controller
                      name="validation.min"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Maximum Value
                    </label>
                    <Controller
                      name="validation.max"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                        />
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pattern (RegEx)
                  </label>
                  <Controller
                    name="validation.pattern"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="e.g., ^[A-Za-z]+$"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Validation Rule
                  </label>
                  <Controller
                    name="validation.customRule"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Enter custom validation expression"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Permissions
                  </h4>
                  <div className="space-y-2">
                    <Controller
                      name="permissions.canEdit"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Can be edited
                          </span>
                        </label>
                      )}
                    />
                    <Controller
                      name="permissions.canDelete"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Can be deleted
                          </span>
                        </label>
                      )}
                    />
                    <Controller
                      name="permissions.canReorder"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Can be reordered
                          </span>
                        </label>
                      )}
                    />
                    <Controller
                      name="permissions.adminOnly"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            {...field}
                            checked={field.value}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Admin only
                          </span>
                        </label>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={generatePreview}
                className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Preview
              </button>
              
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || validationErrors.length > 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isEditing ? 'Update Column' : 'Create Column'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ColumnEditor;
