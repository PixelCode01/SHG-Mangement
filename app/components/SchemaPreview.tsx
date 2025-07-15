/**
 * Schema Preview Component
 * Shows how the custom schema will look in tables and reports
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  EyeIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

import { GroupCustomSchema, CustomColumn } from '@/app/types/custom-columns';

interface SchemaPreviewProps {
  schema: GroupCustomSchema;
  onClose: () => void;
}

const SAMPLE_MEMBER_DATA = [
  {
    id: '1',
    name: 'Aarti Sharma',
    loanAmount: 50000,
    contributionAmount: 500,
    familyMembersCount: 4,
    attendance: 'Present',
    meetingDate: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Bhavna Devi',
    loanAmount: 30000,
    contributionAmount: 500,
    familyMembersCount: 3,
    attendance: 'Present',
    meetingDate: new Date('2024-01-15')
  },
  {
    id: '3',
    name: 'Champa Kumari',
    loanAmount: 75000,
    contributionAmount: 500,
    familyMembersCount: 5,
    attendance: 'Absent',
    meetingDate: new Date('2024-01-15')
  },
  {
    id: '4',
    name: 'Deepika Singh',
    loanAmount: 25000,
    contributionAmount: 500,
    familyMembersCount: 2,
    attendance: 'Present',
    meetingDate: new Date('2024-01-15')
  }
];

export function SchemaPreview({ schema, onClose }: SchemaPreviewProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'summary' | 'report'>('table');

  const activeColumns = useMemo(() => {
    return schema.columns.filter(col => col.isActive && col.displayConfig.showInTable);
  }, [schema.columns]);

  const summaryColumns = useMemo(() => {
    return schema.columns.filter(col => col.isActive && col.displayConfig.showInSummary);
  }, [schema.columns]);

  const reportColumns = useMemo(() => {
    return schema.columns.filter(col => col.isActive && col.displayConfig.showInReports);
  }, [schema.columns]);

  // Calculate column values for preview
  const calculateColumnValue = (column: CustomColumn, memberData: any): any => {
    try {
      switch (column.dataType) {
        case 'calculated':
        case 'property-driven':
          if (column.formula) {
            // Simple calculation for demo purposes
            let expression = column.formula.expression;
            
            // Replace common patterns
            expression = expression.replace(/loanAmount/g, memberData.loanAmount.toString());
            expression = expression.replace(/familyMembersCount/g, memberData.familyMembersCount.toString());
            expression = expression.replace(/contributionAmount/g, memberData.contributionAmount.toString());
            
            // Replace property values
            column.properties.forEach(prop => {
              expression = expression.replace(new RegExp(prop.id, 'g'), prop.value.toString());
            });
            
            // Basic math evaluation (simplified)
            expression = expression.replace(/\s/g, '');
            if (/^[\d\+\-\*\/\(\)\.]+$/.test(expression)) {
              try {
                const result = eval(expression);
                return isNaN(result) ? 0 : result;
              } catch {
                return 0;
              }
            }
            return 0;
          }
          return 0;
        
        case 'dropdown':
          if (column.dropdownOptions && column.dropdownOptions.length > 0) {
            return memberData[column.name.toLowerCase()] || column.dropdownOptions[0].value;
          }
          return '';
        
        case 'boolean':
          return Math.random() > 0.5;
        
        case 'date':
          return memberData.meetingDate;
        
        case 'currency':
        case 'number':
        case 'percentage':
          return memberData[column.name.toLowerCase().replace(/\s+/g, '')] || Math.random() * 1000;
        
        default:
          return memberData[column.name.toLowerCase().replace(/\s+/g, '')] || 'Sample Value';
      }
    } catch {
      return 'Error';
    }
  };

  const formatValue = (value: any, column: CustomColumn): string => {
    if (value === null || value === undefined) return '-';
    
    const formatType = column.displayConfig.formatType;
    const decimalPlaces = column.displayConfig.decimalPlaces || 2;
    const prefix = column.displayConfig.prefix || '';
    const suffix = column.displayConfig.suffix || '';
    
    switch (formatType) {
      case 'currency':
        return `${prefix}₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}${suffix}`;
      
      case 'percentage':
        return `${prefix}${Number(value).toFixed(decimalPlaces)}%${suffix}`;
      
      case 'number':
        return `${prefix}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}${suffix}`;
      
      case 'date':
        if (value instanceof Date) {
          return `${prefix}${value.toLocaleDateString('en-IN')}${suffix}`;
        }
        return `${prefix}${value}${suffix}`;
      
      default:
        return `${prefix}${value}${suffix}`;
    }
  };

  const calculateSummary = (column: CustomColumn): string => {
    const values = SAMPLE_MEMBER_DATA.map(member => calculateColumnValue(column, member));
    
    switch (column.displayConfig.aggregateType) {
      case 'sum':
        const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
        return formatValue(sum, column);
      
      case 'average':
        const avg = values.reduce((acc, val) => acc + (Number(val) || 0), 0) / values.length;
        return formatValue(avg, column);
      
      case 'count':
        const count = values.filter(val => val !== null && val !== undefined && val !== '').length;
        return formatValue(count, column);
      
      default:
        return '-';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Schema Preview
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Preview how your custom schema will appear in tables and reports
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-600">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'table', label: 'Table View', icon: TableCellsIcon },
              { key: 'summary', label: 'Summary', icon: ChartBarIcon },
              { key: 'report', label: 'Report Format', icon: DocumentTextIcon }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
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
          {/* Table View */}
          {activeTab === 'table' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Member Contribution Table
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {activeColumns.length} active columns in table view
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Member Name
                      </th>
                      {activeColumns.map(column => (
                        <th
                          key={column.id}
                          className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                            column.displayConfig.alignment === 'center' ? 'text-center' :
                            column.displayConfig.alignment === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {SAMPLE_MEMBER_DATA.map(member => (
                      <tr key={member.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {member.name}
                        </td>
                        {activeColumns.map(column => {
                          const value = calculateColumnValue(column, member);
                          return (
                            <td
                              key={column.id}
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${
                                column.displayConfig.alignment === 'center' ? 'text-center' :
                                column.displayConfig.alignment === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {formatValue(value, column)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary View */}
          {activeTab === 'summary' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Summary Report
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {summaryColumns.length} columns with aggregation in summary
                </p>
              </div>
              
              {summaryColumns.length === 0 ? (
                <div className="text-center py-12">
                  <ChartBarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Summary Columns
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Enable "Show in Summary" for columns to see them here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {summaryColumns.map(column => (
                    <div key={column.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {column.name}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {column.displayConfig.aggregateType}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {calculateSummary(column)}
                      </div>
                      {column.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {column.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Report Format */}
          {activeTab === 'report' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Generated Report Format
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preview of how data will appear in exported reports
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                {/* Report Header */}
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    SHG Contribution Report
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Group: {schema.name || 'Sample Group'} | Date: {new Date().toLocaleDateString('en-IN')}
                  </p>
                </div>

                {/* Report Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">
                          S.No.
                        </th>
                        <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100">
                          Member Name
                        </th>
                        {reportColumns.map(column => (
                          <th
                            key={column.id}
                            className={`border border-gray-300 dark:border-gray-600 px-4 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 ${
                              column.displayConfig.alignment === 'center' ? 'text-center' :
                              column.displayConfig.alignment === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {column.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SAMPLE_MEMBER_DATA.map((member, index) => (
                        <tr key={member.id}>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {index + 1}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            {member.name}
                          </td>
                          {reportColumns.map(column => {
                            const value = calculateColumnValue(column, member);
                            return (
                              <td
                                key={column.id}
                                className={`border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 ${
                                  column.displayConfig.alignment === 'center' ? 'text-center' :
                                  column.displayConfig.alignment === 'right' ? 'text-right' : 'text-left'
                                }`}
                              >
                                {formatValue(value, column)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Report Summary */}
                {summaryColumns.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                      Summary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {summaryColumns.map(column => (
                        <div key={column.id} className="text-center">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {column.name}
                          </div>
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {calculateSummary(column)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Report Footer */}
                <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-600 text-center text-xs text-gray-500 dark:text-gray-400">
                  Generated on {new Date().toLocaleString('en-IN')} | SHG Management System
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Schema: {schema.columns.length} columns, {schema.columns.filter(c => c.isActive).length} active
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                // In a real implementation, this would generate and download a PDF report
                alert('Report download functionality would be implemented here');
              }}
              className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Download Sample
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchemaPreview;
