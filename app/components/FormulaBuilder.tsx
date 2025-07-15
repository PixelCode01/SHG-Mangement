/**
 * Formula Builder Component
 * Advanced visual formula builder for calculated columns
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CalculatorIcon,
  InformationCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

import { ColumnFormula, CustomColumn, ColumnProperty } from '@/app/types/custom-columns';

interface FormulaBuilderProps {
  formula?: ColumnFormula;
  availableColumns: CustomColumn[];
  availableProperties: ColumnProperty[];
  onChange: (formula: ColumnFormula | undefined) => void;
}

type FormulaOperator = '+' | '-' | '*' | '/' | '(' | ')' | '>' | '<' | '=' | '!=' | '>=' | '<=';

interface FormulaToken {
  type: 'column' | 'property' | 'operator' | 'number' | 'function' | 'parenthesis';
  value: string;
  displayName?: string;
  description?: string;
}

const OPERATORS: { value: FormulaOperator; label: string; description: string }[] = [
  { value: '+', label: '+', description: 'Addition' },
  { value: '-', label: '-', description: 'Subtraction' },
  { value: '*', label: '×', description: 'Multiplication' },
  { value: '/', label: '÷', description: 'Division' },
  { value: '(', label: '(', description: 'Open parenthesis' },
  { value: ')', label: ')', description: 'Close parenthesis' },
  { value: '>', label: '>', description: 'Greater than' },
  { value: '<', label: '<', description: 'Less than' },
  { value: '=', label: '=', description: 'Equals' },
  { value: '!=', label: '≠', description: 'Not equals' },
  { value: '>=', label: '≥', description: 'Greater or equal' },
  { value: '<=', label: '≤', description: 'Less or equal' }
];

const FUNCTIONS = [
  { name: 'SUM', description: 'Sum of values', syntax: 'SUM(value1, value2, ...)' },
  { name: 'AVG', description: 'Average of values', syntax: 'AVG(value1, value2, ...)' },
  { name: 'MIN', description: 'Minimum value', syntax: 'MIN(value1, value2, ...)' },
  { name: 'MAX', description: 'Maximum value', syntax: 'MAX(value1, value2, ...)' },
  { name: 'IF', description: 'Conditional value', syntax: 'IF(condition, trueValue, falseValue)' },
  { name: 'ROUND', description: 'Round to decimal places', syntax: 'ROUND(value, decimals)' },
  { name: 'ABS', description: 'Absolute value', syntax: 'ABS(value)' },
  { name: 'SQRT', description: 'Square root', syntax: 'SQRT(value)' },
  { name: 'COUNT', description: 'Count of non-empty values', syntax: 'COUNT(value1, value2, ...)' }
];

export function FormulaBuilder({ 
  formula, 
  availableColumns, 
  availableProperties, 
  onChange 
}: FormulaBuilderProps) {
  const [expression, setExpression] = useState(formula?.expression || '');
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>({ isValid: true, errors: [], warnings: [] });
  const [selectedMode, setSelectedMode] = useState<'visual' | 'text'>('visual');
  const [tokens, setTokens] = useState<FormulaToken[]>([]);
  const [previewResult, setPreviewResult] = useState<number | string | null>(null);
  const [conditions, setConditions] = useState(formula?.conditions || []);

  // Parse expression into tokens
  useEffect(() => {
    if (expression) {
      const parsedTokens = parseExpression(expression);
      setTokens(parsedTokens);
    } else {
      setTokens([]);
    }
  }, [expression]);

  // Validate formula
  useEffect(() => {
    const result = validateFormula(expression, availableColumns, availableProperties);
    setValidationResult(result);
  }, [expression, availableColumns, availableProperties]);

  // Update parent component
  useEffect(() => {
    if (expression.trim()) {
      const referencedColumns = extractReferencedColumns(expression, availableColumns);
      const referencedProperties = extractReferencedProperties(expression, availableProperties);
      
      const updatedFormula: ColumnFormula = {
        id: formula?.id || `formula-${Date.now()}`,
        expression: expression,
        referencedColumns: referencedColumns,
        referencedProperties: referencedProperties,
        ...(conditions.length > 0 && { conditions }),
        validation: {
          required: false
        }
      };
      
      onChange(updatedFormula);
    } else {
      onChange(undefined);
    }
  }, [expression, conditions, formula?.id, availableColumns, availableProperties, onChange]);

  const parseExpression = (expr: string): FormulaToken[] => {
    // Simple tokenizer - in production, use a proper parser
    const tokens: FormulaToken[] = [];
    const regex = /(\w+|\+|\-|\*|\/|\(|\)|>=|<=|!=|>|<|=|\d+\.?\d*)/g;
    let match;
    
    while ((match = regex.exec(expr)) !== null) {
      const value = match[1];
      if (!value) continue;
      
      let type: FormulaToken['type'] = 'operator';
      let displayName = value;
      let description = '';
      
      // Determine token type
      if (/^\d+\.?\d*$/.test(value)) {
        type = 'number';
      } else if (OPERATORS.some(op => op.value === value)) {
        type = 'operator';
        const operator = OPERATORS.find(op => op.value === value);
        displayName = operator?.label || value;
        description = operator?.description || '';
      } else if (value === '(' || value === ')') {
        type = 'parenthesis';
      } else if (FUNCTIONS.some(fn => fn.name === value.toUpperCase())) {
        type = 'function';
        description = FUNCTIONS.find(fn => fn.name === value.toUpperCase())?.description || '';
      } else {
        // Check if it's a column or property
        const column = availableColumns.find(col => col.id === value || col.name.toLowerCase().replace(/\s+/g, '') === value.toLowerCase());
        const property = availableProperties.find(prop => prop.id === value || prop.name.toLowerCase().replace(/\s+/g, '') === value.toLowerCase());
        
        if (column) {
          type = 'column';
          displayName = column.name;
          description = column.description || `Column: ${column.name}`;
        } else if (property) {
          type = 'property';
          displayName = property.name;
          description = property.description || `Property: ${property.name}`;
        }
      }
      
      tokens.push({ type, value, displayName, description });
    }
    
    return tokens;
  };

  const validateFormula = (expr: string, columns: CustomColumn[], properties: ColumnProperty[]) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!expr.trim()) {
      return { isValid: true, errors, warnings };
    }
    
    // Check parentheses balance
    const openParens = (expr.match(/\(/g) || []).length;
    const closeParens = (expr.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Mismatched parentheses');
    }
    
    // Check for valid characters
    if (!/^[\w\s\+\-\*\/\(\)>=<!\.]+$/.test(expr)) {
      errors.push('Invalid characters in expression');
    }
    
    // Check if referenced columns exist
    const referencedColumns = extractReferencedColumns(expr, columns);
    const invalidColumns = referencedColumns.filter(id => !columns.some(col => col.id === id));
    if (invalidColumns.length > 0) {
      errors.push(`Referenced columns not found: ${invalidColumns.join(', ')}`);
    }
    
    // Check if referenced properties exist
    const referencedProperties = extractReferencedProperties(expr, properties);
    const invalidProperties = referencedProperties.filter(id => !properties.some(prop => prop.id === id));
    if (invalidProperties.length > 0) {
      errors.push(`Referenced properties not found: ${invalidProperties.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  const extractReferencedColumns = (expr: string, columns: CustomColumn[]): string[] => {
    const references: string[] = [];
    columns.forEach(column => {
      const columnRef = column.id;
      const columnNameRef = column.name.toLowerCase().replace(/\s+/g, '');
      if (expr.includes(columnRef) || expr.toLowerCase().includes(columnNameRef)) {
        references.push(column.id);
      }
    });
    return [...new Set(references)];
  };

  const extractReferencedProperties = (expr: string, properties: ColumnProperty[]): string[] => {
    const references: string[] = [];
    properties.forEach(property => {
      const propRef = property.id;
      const propNameRef = property.name.toLowerCase().replace(/\s+/g, '');
      if (expr.includes(propRef) || expr.toLowerCase().includes(propNameRef)) {
        references.push(property.id);
      }
    });
    return [...new Set(references)];
  };

  const insertIntoExpression = useCallback((value: string) => {
    setExpression(prev => prev + value);
  }, []);

  const insertColumn = useCallback((column: CustomColumn) => {
    const columnRef = column.id;
    insertIntoExpression(columnRef);
  }, [insertIntoExpression]);

  const insertProperty = useCallback((property: ColumnProperty) => {
    const propertyRef = property.id;
    insertIntoExpression(propertyRef);
  }, [insertIntoExpression]);

  const insertOperator = useCallback((operator: FormulaOperator) => {
    insertIntoExpression(` ${operator} `);
  }, [insertIntoExpression]);

  const insertFunction = useCallback((functionName: string) => {
    insertIntoExpression(`${functionName}(`);
  }, [insertIntoExpression]);

  const clearExpression = useCallback(() => {
    setExpression('');
  }, []);

  const calculatePreview = useCallback(() => {
    // Mock calculation for preview
    try {
      // Create sample data
      const sampleData: Record<string, any> = {};
      
      // Add sample column values
      availableColumns.forEach(col => {
        switch (col.dataType) {
          case 'currency':
          case 'number':
            sampleData[col.id] = Math.random() * 10000;
            break;
          case 'percentage':
            sampleData[col.id] = Math.random() * 100;
            break;
          default:
            sampleData[col.id] = 100; // Default number for calculation
        }
      });
      
      // Add sample property values
      availableProperties.forEach(prop => {
        sampleData[prop.id] = typeof prop.value === 'number' ? prop.value : 0;
      });
      
      // Simple evaluation (in production, use a safe expression evaluator)
      let evalExpression = expression;
      
      // Replace references with values
      Object.keys(sampleData).forEach(key => {
        evalExpression = evalExpression.replace(new RegExp(key, 'g'), sampleData[key].toString());
      });
      
      // Basic function replacements
      evalExpression = evalExpression.replace(/SUM\(([^)]+)\)/g, (_, args) => {
        const values = args.split(',').map((v: string) => parseFloat(v.trim()) || 0);
        return values.reduce((sum: number, val: number) => sum + val, 0).toString();
      });
      
      evalExpression = evalExpression.replace(/AVG\(([^)]+)\)/g, (_, args) => {
        const values = args.split(',').map((v: string) => parseFloat(v.trim()) || 0);
        const sum = values.reduce((sum: number, val: number) => sum + val, 0);
        return (sum / values.length).toString();
      });
      
      // Try to evaluate (this is simplified - use a proper math parser in production)
      const result = eval(evalExpression);
      setPreviewResult(typeof result === 'number' ? Math.round(result * 100) / 100 : result);
    } catch (error) {
      setPreviewResult('Error');
    }
  }, [expression, availableColumns, availableProperties]);

  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, {
      if: '',
      then: '',
      else: ''
    }]);
  }, []);

  const updateCondition = useCallback((index: number, field: 'if' | 'then' | 'else', value: string) => {
    setConditions(prev => prev.map((condition, i) => 
      i === index ? { ...condition, [field]: value } : condition
    ));
  }, []);

  const removeCondition = useCallback((index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Formula Builder
        </h3>
        
        <div className="flex items-center space-x-2">
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              onClick={() => setSelectedMode('visual')}
              className={`px-4 py-2 text-sm rounded-l-lg transition-colors ${
                selectedMode === 'visual'
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setSelectedMode('text')}
              className={`px-4 py-2 text-sm rounded-r-lg transition-colors ${
                selectedMode === 'text'
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Text
            </button>
          </div>
          
          <button
            onClick={calculatePreview}
            className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <EyeIcon className="w-4 h-4 mr-2" />
            Preview
          </button>
        </div>
      </div>

      {/* Formula Expression */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Formula Expression
        </label>
        <div className="relative">
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Enter your formula (e.g., loanAmount * (insurancePercent / 100))"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            rows={3}
          />
          {expression && (
            <button
              onClick={clearExpression}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Token visualization */}
        {tokens.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tokens.map((token, index) => (
              <span
                key={index}
                className={`px-2 py-1 text-xs rounded-full ${
                  token.type === 'column'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : token.type === 'property'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : token.type === 'function'
                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : token.type === 'operator'
                    ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
                title={token.description}
              >
                {token.displayName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Visual Builder */}
      {selectedMode === 'visual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Columns */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Available Columns
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableColumns.map(column => (
                <button
                  key={column.id}
                  onClick={() => insertColumn(column)}
                  className="w-full text-left px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="font-medium text-sm">{column.name}</div>
                  <div className="text-xs opacity-75">{column.dataType}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Available Properties */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Available Properties
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableProperties.map(property => (
                <button
                  key={property.id}
                  onClick={() => insertProperty(property)}
                  className="w-full text-left px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <div className="font-medium text-sm">{property.name}</div>
                  <div className="text-xs opacity-75">{property.type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Operators and Functions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Operators & Functions
            </h4>
            
            <div className="space-y-3">
              <div>
                <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Operators
                </h5>
                <div className="grid grid-cols-4 gap-2">
                  {OPERATORS.map(operator => (
                    <button
                      key={operator.value}
                      onClick={() => insertOperator(operator.value)}
                      className="px-2 py-1 text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                      title={operator.description}
                    >
                      {operator.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Functions
                </h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {FUNCTIONS.map(func => (
                    <button
                      key={func.name}
                      onClick={() => insertFunction(func.name)}
                      className="w-full text-left px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      title={func.syntax}
                    >
                      {func.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Logic */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Conditional Logic (Optional)
          </h4>
          <button
            onClick={addCondition}
            className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No conditional logic configured. Add conditions to create complex formulas.
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Condition {index + 1}
                  </span>
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      If (condition)
                    </label>
                    <input
                      type="text"
                      value={condition.if}
                      onChange={(e) => updateCondition(index, 'if', e.target.value)}
                      placeholder="e.g., loanAmount > 50000"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Then (value)
                    </label>
                    <input
                      type="text"
                      value={condition.then}
                      onChange={(e) => updateCondition(index, 'then', e.target.value)}
                      placeholder="e.g., loanAmount * 0.02"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Else (fallback)
                    </label>
                    <input
                      type="text"
                      value={condition.else || ''}
                      onChange={(e) => updateCondition(index, 'else', e.target.value)}
                      placeholder="e.g., 0"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Results */}
      {!validationResult.isValid && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg">
          <div className="flex items-center text-red-800 dark:text-red-400 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
            <span className="font-medium">Formula Errors</span>
          </div>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {validationResult.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Result */}
      {previewResult !== null && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-blue-800 dark:text-blue-400">
              <CalculatorIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">Preview Result</span>
            </div>
            <div className="text-lg font-bold text-blue-900 dark:text-blue-300">
              {typeof previewResult === 'number' ? previewResult.toLocaleString() : previewResult}
            </div>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            This is a sample calculation based on mock data
          </p>
        </div>
      )}

      {/* Help */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center text-gray-700 dark:text-gray-300 mb-2">
          <InformationCircleIcon className="w-5 h-5 mr-2" />
          <span className="font-medium">Formula Help</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>• Reference columns by their ID or click them from the list</p>
          <p>• Reference properties by their ID or click them from the list</p>
          <p>• Use standard mathematical operators: +, -, *, /, (, )</p>
          <p>• Use functions like SUM(), AVG(), IF(), ROUND(), etc.</p>
          <p>• Add conditional logic for complex calculations</p>
          <p>• Example: <code className="bg-white dark:bg-gray-700 px-1 rounded">loanAmount * (insurancePercent / 100)</code></p>
        </div>
      </div>
    </div>
  );
}

export default FormulaBuilder;
