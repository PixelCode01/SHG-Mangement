/**
 * Property Editor Component
 * UI for editing column properties that drive calculations
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  TrashIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

import { ColumnProperty, PropertyType, ConditionalOperator } from '@/app/types/custom-columns';

interface PropertyEditorProps {
  property: ColumnProperty;
  index: number;
  onUpdate: (updates: Partial<ColumnProperty>) => void;
  onDelete: () => void;
  showDelete?: boolean;
}

export function PropertyEditor({ 
  property, 
  index, 
  onUpdate, 
  onDelete, 
  showDelete = true 
}: PropertyEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleUpdate = useCallback((field: string, value: any) => {
    onUpdate({ [field]: value });
    
    // Clear validation error when user makes changes
    if (validationError) {
      setValidationError(null);
    }
  }, [onUpdate, validationError]);

  const handleAddTier = useCallback(() => {
    const newTier = {
      condition: '',
      value: 0,
      description: ''
    };
    
    const updatedTiers = [...(property.tiers || []), newTier];
    onUpdate({ tiers: updatedTiers });
  }, [property.tiers, onUpdate]);

  const handleUpdateTier = useCallback((tierIndex: number, field: string, value: any) => {
    const updatedTiers = property.tiers?.map((tier, i) => 
      i === tierIndex ? { ...tier, [field]: value } : tier
    );
    if (updatedTiers) {
      onUpdate({ tiers: updatedTiers });
    }
  }, [property.tiers, onUpdate]);

  const handleDeleteTier = useCallback((tierIndex: number) => {
    const updatedTiers = property.tiers?.filter((_, i) => i !== tierIndex);
    if (updatedTiers) {
      onUpdate({ tiers: updatedTiers });
    }
  }, [property.tiers, onUpdate]);

  const handleAddCondition = useCallback(() => {
    const newCondition = {
      field: '',
      operator: 'greater-than' as ConditionalOperator,
      value: 0,
      result: 0
    };
    
    const updatedConditions = [...(property.conditions || []), newCondition];
    onUpdate({ conditions: updatedConditions });
  }, [property.conditions, onUpdate]);

  const handleUpdateCondition = useCallback((conditionIndex: number, field: string, value: any) => {
    const updatedConditions = property.conditions?.map((condition, i) => 
      i === conditionIndex ? { ...condition, [field]: value } : condition
    );
    if (updatedConditions) {
      onUpdate({ conditions: updatedConditions });
    }
  }, [property.conditions, onUpdate]);

  const handleDeleteCondition = useCallback((conditionIndex: number) => {
    const updatedConditions = property.conditions?.filter((_, i) => i !== conditionIndex);
    if (updatedConditions) {
      onUpdate({ conditions: updatedConditions });
    }
  }, [property.conditions, onUpdate]);

  const renderPropertyTypeHelp = () => {
    const helpText = {
      'percentage': 'A percentage value (e.g., 0.2 for 0.2%)',
      'fixed-amount': 'A fixed amount (e.g., ₹50)',
      'per-member-amount': 'Amount per member (e.g., ₹10 per member)',
      'tiered-amount': 'Different amounts based on conditions',
      'conditional-amount': 'Amount based on conditional logic'
    };
    
    return (
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
        <InformationCircleIcon className="w-3 h-3 mr-1" />
        {helpText[property.type]}
      </div>
    );
  };

  const renderValueInput = () => {
    switch (property.type) {
      case 'percentage':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={property.value as number}
              onChange={(e) => handleUpdate('value', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              max="100"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="0.00"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
          </div>
        );
      
      case 'fixed-amount':
      case 'per-member-amount':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">₹</span>
            <input
              type="number"
              value={property.value as number}
              onChange={(e) => handleUpdate('value', parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="0.00"
            />
          </div>
        );
      
      case 'tiered-amount':
        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Configure tiers with different amounts based on conditions
            </div>
            
            {property.tiers?.map((tier, tierIndex) => (
              <div key={tierIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tier {tierIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTier(tierIndex)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Condition
                    </label>
                    <input
                      type="text"
                      value={tier.condition}
                      onChange={(e) => handleUpdateTier(tierIndex, 'condition', e.target.value)}
                      placeholder="e.g., loanAmount > 50000"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      value={tier.value}
                      onChange={(e) => handleUpdateTier(tierIndex, 'value', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={tier.description || ''}
                      onChange={(e) => handleUpdateTier(tierIndex, 'description', e.target.value)}
                      placeholder="Optional description"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddTier}
              className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Tier
            </button>
          </div>
        );
      
      case 'conditional-amount':
        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Configure conditions that determine the amount
            </div>
            
            {property.conditions?.map((condition, conditionIndex) => (
              <div key={conditionIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Condition {conditionIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCondition(conditionIndex)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Field
                    </label>
                    <input
                      type="text"
                      value={condition.field}
                      onChange={(e) => handleUpdateCondition(conditionIndex, 'field', e.target.value)}
                      placeholder="e.g., loanAmount"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Operator
                    </label>
                    <select
                      value={condition.operator}
                      onChange={(e) => handleUpdateCondition(conditionIndex, 'operator', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="greater-than">Greater Than</option>
                      <option value="less-than">Less Than</option>
                      <option value="equals">Equals</option>
                      <option value="not-equals">Not Equals</option>
                      <option value="greater-equal">Greater or Equal</option>
                      <option value="less-equal">Less or Equal</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      value={condition.value as number}
                      onChange={(e) => handleUpdateCondition(conditionIndex, 'value', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Result
                    </label>
                    <input
                      type="number"
                      value={condition.result as number}
                      onChange={(e) => handleUpdateCondition(conditionIndex, 'result', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddCondition}
              className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Condition
            </button>
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={property.value as string}
            onChange={(e) => handleUpdate('value', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
          
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {property.name || `Property ${index + 1}`}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {property.type.replace('-', ' ')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {typeof property.value === 'number' ? property.value.toLocaleString() : String(property.value)}
          </span>
          {showDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Property Name
              </label>
              <input
                type="text"
                value={property.name}
                onChange={(e) => handleUpdate('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                placeholder="Enter property name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={property.type}
                onChange={(e) => handleUpdate('type', e.target.value as PropertyType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed-amount">Fixed Amount</option>
                <option value="per-member-amount">Per Member Amount</option>
                <option value="tiered-amount">Tiered Amount</option>
                <option value="conditional-amount">Conditional Amount</option>
              </select>
              {renderPropertyTypeHelp()}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={property.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="Describe how this property is used"
            />
          </div>

          {/* Value Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value Configuration
            </label>
            {renderValueInput()}
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center text-red-600 text-sm">
              <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
              {validationError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PropertyEditor;
