/**
 * PDF Import Component for Custom Columns
 * Integrates PDF data extraction with the Custom Columns system
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { 
  DocumentArrowUpIcon, 
  DocumentCheckIcon, 
  ExclamationTriangleIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

import { GroupCustomSchema, CustomColumn } from '@/app/types/custom-columns';

interface PDFImportProps {
  schema: GroupCustomSchema;
  onDataImported: (data: Record<string, any>[]) => void;
  onClose: () => void;
}

interface ExtractedData {
  [key: string]: any;
}

export function PDFImport({ schema, onDataImported, onClose }: PDFImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'review'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF text extraction using client-side processing
  const extractTextFromPDF = useCallback(async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Convert to text (basic extraction)
          const text = new TextDecoder().decode(uint8Array);
          const lines = text.split('\n').filter(line => line.trim().length > 0);
          
          resolve(lines);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Process PDF data based on SHG statement patterns
  const processStatementData = useCallback((lines: string[]): ExtractedData[] => {
    const data: ExtractedData[] = [];
    const patterns = {
      name: /^[A-Z][a-z]+\s+[A-Z][a-z]+/,
      amount: /₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
      date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      balance: /Balance.*?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
    };

    let currentEntry: ExtractedData = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (patterns.name.test(trimmedLine)) {
        if (Object.keys(currentEntry).length > 0) {
          data.push(currentEntry);
        }
        currentEntry = { name: trimmedLine };
      }
      
      if (patterns.amount.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.amount);
        if (match) {
          currentEntry.amount = parseFloat(match[1].replace(/,/g, ''));
        }
      }
      
      if (patterns.date.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.date);
        if (match) {
          currentEntry.date = match[1];
        }
      }
      
      if (patterns.balance.test(trimmedLine)) {
        const match = trimmedLine.match(patterns.balance);
        if (match) {
          currentEntry.balance = parseFloat(match[1].replace(/,/g, ''));
        }
      }
    }
    
    if (Object.keys(currentEntry).length > 0) {
      data.push(currentEntry);
    }
    
    return data;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setErrors(['Please select a PDF file']);
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);

    try {
      const lines = await extractTextFromPDF(selectedFile);
      setPreviewData(lines.slice(0, 20)); // Preview first 20 lines
      setStep('preview');
    } catch (error) {
      setErrors(['Failed to extract text from PDF. Please try again.']);
    } finally {
      setIsProcessing(false);
    }
  }, [extractTextFromPDF]);

  // Process extracted data
  const handleProcessData = useCallback(() => {
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const processed = processStatementData(previewData);
      setExtractedData(processed);
      
      // Auto-generate mappings based on schema
      const autoMappings: Record<string, string> = {};
      schema.columns.forEach(column => {
        const columnName = column.name.toLowerCase();
        if (columnName.includes('name') || columnName.includes('member')) {
          autoMappings[column.id] = 'name';
        } else if (columnName.includes('amount') || columnName.includes('contribution')) {
          autoMappings[column.id] = 'amount';
        } else if (columnName.includes('date')) {
          autoMappings[column.id] = 'date';
        } else if (columnName.includes('balance')) {
          autoMappings[column.id] = 'balance';
        }
      });
      
      setMappings(autoMappings);
      setStep('mapping');
    } catch (error) {
      setErrors(['Failed to process PDF data. Please check the file format.']);
    } finally {
      setIsProcessing(false);
    }
  }, [file, previewData, schema.columns, processStatementData]);

  // Handle mapping changes
  const handleMappingChange = useCallback((columnId: string, field: string) => {
    setMappings(prev => ({
      ...prev,
      [columnId]: field
    }));
  }, []);

  // Generate final mapped data
  const generateMappedData = useCallback(() => {
    return extractedData.map(item => {
      const mapped: Record<string, any> = {};
      
      schema.columns.forEach(column => {
        const fieldMapping = mappings[column.id];
        if (fieldMapping && item[fieldMapping] !== undefined) {
          mapped[column.id] = item[fieldMapping];
        }
      });
      
      return mapped;
    });
  }, [extractedData, mappings, schema.columns]);

  // Handle final import
  const handleImport = useCallback(() => {
    const mappedData = generateMappedData();
    onDataImported(mappedData);
    onClose();
  }, [generateMappedData, onDataImported, onClose]);

  // Reset to start
  const handleReset = useCallback(() => {
    setFile(null);
    setExtractedData([]);
    setMappings({});
    setPreviewData([]);
    setErrors([]);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Import from PDF Statement
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {[
              { key: 'upload', label: 'Upload PDF' },
              { key: 'preview', label: 'Preview Data' },
              { key: 'mapping', label: 'Map Columns' },
              { key: 'review', label: 'Review & Import' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step === stepItem.key ? 'border-blue-500 bg-blue-500 text-white' :
                  ['preview', 'mapping', 'review'].includes(step) && index < ['upload', 'preview', 'mapping', 'review'].indexOf(step)
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 text-gray-300'
                }`}>
                  {step === stepItem.key ? (
                    <span className="text-sm font-medium">{index + 1}</span>
                  ) : (
                    ['preview', 'mapping', 'review'].includes(step) && index < ['upload', 'preview', 'mapping', 'review'].indexOf(step) ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )
                  )}
                </div>
                <span className={`ml-2 text-sm ${
                  step === stepItem.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepItem.label}
                </span>
                {index < 3 && (
                  <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-600 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                  Errors
                </span>
              </div>
              <ul className="mt-2 text-sm text-red-700 dark:text-red-300">
                {errors.map((error, index) => (
                  <li key={index} className="list-disc list-inside">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step Content */}
          {step === 'upload' && (
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
                <DocumentArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Upload PDF Statement
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Select a PDF file containing member data to import
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Select PDF File'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Preview Extracted Text
                </h4>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ArrowPathIcon className="h-4 w-4 inline mr-1" />
                  Start Over
                </button>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  First 20 lines extracted from PDF:
                </div>
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-x-auto">
                  {previewData.join('\n')}
                </pre>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleProcessData}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Process Data'}
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Map PDF Fields to Custom Columns
              </h4>
              
              <div className="space-y-4">
                {schema.columns.map(column => (
                  <div key={column.id} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {column.name}
                      </label>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {column.description}
                      </div>
                    </div>
                    <div className="flex-1">
                      <select
                        value={mappings[column.id] || ''}
                        onChange={(e) => handleMappingChange(column.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">-- Select Field --</option>
                        <option value="name">Name</option>
                        <option value="amount">Amount</option>
                        <option value="date">Date</option>
                        <option value="balance">Balance</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={Object.keys(mappings).length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review Data
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Review & Import Data
              </h4>
              
              <div className="mb-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Found {extractedData.length} records. Preview:
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {schema.columns.map(column => (
                        <th key={column.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {generateMappedData().slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {schema.columns.map(column => (
                          <td key={column.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {row[column.id] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {extractedData.length > 5 && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  ... and {extractedData.length - 5} more records
                </div>
              )}
              
              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                >
                  Back to Mapping
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Import {extractedData.length} Records
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
