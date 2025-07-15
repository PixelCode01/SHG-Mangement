/**
 * Template Selector Component
 * UI for selecting predefined column templates
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

import { ColumnTemplate } from '@/app/types/custom-columns';

interface TemplateSelectorProps {
  templates: ColumnTemplate[];
  onSelect: (template: ColumnTemplate) => void;
  onClose: () => void;
}

export function TemplateSelector({ templates, onSelect, onClose }: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ColumnTemplate | null>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(templates.map(t => t.category))];
    return cats.sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchTerm, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-5 h-5";
    switch (category) {
      case 'contribution':
        return <ChartBarIcon className={iconClass} />;
      case 'loan':
        return <CurrencyDollarIcon className={iconClass} />;
      case 'insurance':
        return <BookmarkIcon className={iconClass} />;
      case 'social':
        return <UserGroupIcon className={iconClass} />;
      case 'fine':
        return <ExclamationTriangleIcon className={iconClass} />;
      case 'education':
        return <AcademicCapIcon className={iconClass} />;
      default:
        return <BookmarkIcon className={iconClass} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contribution':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
      case 'loan':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300';
      case 'insurance':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300';
      case 'social':
        return 'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300';
      case 'fine':
        return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      case 'education':
        return 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const handleTemplateSelect = (template: ColumnTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Choose Column Template
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select from predefined templates for common SHG column types
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-600 p-4">
            {/* Search */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categories
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All Categories ({templates.length})
                </button>
                {categories.map(category => {
                  const count = templates.filter(t => t.category === category).length;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
                        selectedCategory === category
                          ? getCategoryColor(category)
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {getCategoryIcon(category)}
                      <span className="ml-2 capitalize">{category} ({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <BookmarkIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No templates found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Try adjusting your search criteria or category filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {/* Selection Indicator */}
                      {selectedTemplate?.id === template.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <CheckIcon className="w-4 h-4 text-white" />
                        </div>
                      )}

                      {/* Template Header */}
                      <div className="flex items-center mb-3">
                        {getCategoryIcon(template.category)}
                        <div className="ml-3">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {template.name}
                          </h3>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${getCategoryColor(template.category)}`}>
                            {template.category}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {template.description}
                      </p>

                      {/* Properties Preview */}
                      {template.defaultProperties.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Properties
                          </h4>
                          <div className="space-y-1">
                            {template.defaultProperties.slice(0, 2).map(prop => (
                              <div key={prop.id} className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">{prop.name}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {typeof prop.value === 'number' ? prop.value.toLocaleString() : String(prop.value)}
                                </span>
                              </div>
                            ))}
                            {template.defaultProperties.length > 2 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                +{template.defaultProperties.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Formula Preview */}
                      {template.defaultFormula && (
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Formula
                          </h4>
                          <div className="bg-gray-100 dark:bg-gray-700 rounded p-2">
                            <code className="text-xs text-gray-700 dark:text-gray-300">
                              {template.defaultFormula.expression}
                            </code>
                          </div>
                        </div>
                      )}

                      {/* Display Config */}
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Type: {template.dataType}</span>
                        <span>
                          {template.displayConfig.showInSummary && '📊 '}
                          {template.displayConfig.formatType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedTemplate ? (
              <span>
                Selected: <span className="font-medium">{selectedTemplate.name}</span>
              </span>
            ) : (
              'Select a template to continue'
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateSelector;
