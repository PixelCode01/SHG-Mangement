import React from 'react';

export interface ReportModalProps {
  showModal: boolean;
  onClose: () => void;
  onGeneratePDF: () => void;
  onGenerateExcel: () => void;
  onGenerateCSV: () => void;
  periodName: string;
  isHistorical: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({
  showModal,
  onClose,
  onGeneratePDF,
  onGenerateExcel,
  onGenerateCSV,
  periodName,
  isHistorical
}) => {
  if (!showModal) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Generate Report
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose the format for your {isHistorical ? 'historical' : 'current'} contribution report for {periodName}:
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onGeneratePDF}
              className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-8 h-8 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">PDF Report</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Formatted document with tables</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={onGenerateExcel}
              className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-8 h-8 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Excel Report</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Spreadsheet with calculations</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={onGenerateCSV}
              className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-8 h-8 text-blue-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">CSV Report</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Data for import/analysis</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
