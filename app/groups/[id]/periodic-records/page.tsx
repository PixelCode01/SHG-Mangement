'use client';

import Link from 'next/link';
import { useState, useEffect, use } from 'react';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PeriodicRecord = {
  id: string;
  meetingDate: Date;
  recordSequenceNumber: number | null;
  membersPresent: number | null;
  newMembersJoinedThisPeriod: number | null;
  
  // Core Financials
  totalCollectionThisPeriod: number | null;
  standingAtStartOfPeriod: number | null;
  cashInBankAtEndOfPeriod: number | null;
  cashInHandAtEndOfPeriod: number | null;
  expensesThisPeriod: number | null;
  totalGroupStandingAtEndOfPeriod: number | null;
  
  // Income Details
  interestEarnedThisPeriod: number | null;
  newContributionsThisPeriod: number | null;
  loanProcessingFeesCollectedThisPeriod: number | null;
  lateFinesCollectedThisPeriod: number | null;
  loanInterestRepaymentsThisPeriod: number | null;
};

type SortOrder = 'asc' | 'desc'; // Added SortOrder type

// Helper function to fetch periodic records
async function getPeriodicRecords(groupId: string): Promise<PeriodicRecord[]> {
  console.log(`Fetching periodic records for groupId: ${groupId}`); // Log the groupId being used
  const response = await fetch(`/api/groups/${groupId}/periodic-records`);
  if (!response.ok) {
    const errorBody = await response.text(); // Use .text() in case it's not JSON
    console.error(`API Error for groupId '${groupId}': Status ${response.status}, Body: ${errorBody}`);
    throw new Error(`Failed to fetch periodic records for groupId '${groupId}'. Status: ${response.status}, Body: ${errorBody}`);
  }
  const data = await response.json();
  // Ensure the fetched data is mapped to the PeriodicRecord type, especially date fields
  return data.map((record: any) => ({
    ...record,
    meetingDate: new Date(record.meetingDate), // Ensure meetingDate is a Date object
  }));
}

export default function PeriodicRecordsPage({ params: paramsFromProps }: PageProps) {
  const resolvedParams = use(paramsFromProps);
  const groupId = resolvedParams.id;

  const [records, setRecords] = useState<PeriodicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // Default to descending (newest first)
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]); // Added for batch delete
  const [isBatchDeleting, setIsBatchDeleting] = useState(false); // Added for loading state

  useEffect(() => {
    getPeriodicRecords(groupId)
      .then(data => {
        // Sort initial data
        const sortedData = [...data].sort((a, b) => {
          const dateA = new Date(a.meetingDate).getTime(); // Changed from a.date
          const dateB = new Date(b.meetingDate).getTime(); // Changed from b.date
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        setRecords(sortedData);
        setError(null);
      })
      .catch(err => {
        console.error("Failed to fetch records:", err);
        setError("Failed to load records.");
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, [groupId, sortOrder]); // Add sortOrder to dependencies

  const handleSortToggle = () => {
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newSortOrder);
    const sortedRecords = [...records].sort((a, b) => {
      const dateA = new Date(a.meetingDate).getTime(); // Changed from a.date
      const dateB = new Date(b.meetingDate).getTime(); // Changed from b.date
      return newSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    setRecords(sortedRecords);
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecordIds(prevSelected =>
      prevSelected.includes(recordId)
        ? prevSelected.filter(id => id !== recordId)
        : [...prevSelected, recordId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      setSelectedRecordIds([]); // Deselect all
    } else {
      setSelectedRecordIds(records.map(record => record.id)); // Select all
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRecordIds.length === 0) {
      alert('Please select records to delete.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedRecordIds.length} selected record(s)?`)) {
      setIsBatchDeleting(true); // Start loading
      try {
        // Simulating individual deletions for now:
        for (const recordId of selectedRecordIds) {
          const response = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            console.error(`Failed to delete record ${recordId}`);
            throw new Error(`Failed to delete record ${recordId}. Some records may not have been deleted.`);
          }
        }

        setRecords(records.filter(record => !selectedRecordIds.includes(record.id)));
        setSelectedRecordIds([]); // Clear selection
        alert('Selected records deleted successfully.');
      } catch (err) {
        console.error("Failed to batch delete records:", err);
        alert(`Failed to delete records. ${err instanceof Error ? err.message : ''}`);
      } finally {
        setIsBatchDeleting(false); // Stop loading
      }
    }
  };

  const handleDelete = async (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const response = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete record');
        }
        // Refresh records after deletion
        setRecords(records.filter(record => record.id !== recordId));
        alert('Record deleted successfully.');
      } catch (err) {
        console.error("Failed to delete record:", err);
        alert(`Failed to delete record. ${err instanceof Error ? err.message : ''}`);
      }
    }
  };

  if (loading) return <p className="container mx-auto p-4 text-gray-600 dark:text-gray-300">Loading records...</p>;
  if (error) return <p className="container mx-auto p-4 text-red-600 dark:text-red-400">{error}</p>;

  const allRecordsSelected = records.length > 0 && selectedRecordIds.length === records.length;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Periodic Records</h1>
        <div className="flex items-center space-x-2">
          {records.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="btn btn-sm btn-outline"
              disabled={isBatchDeleting} // Disable while deleting
            >
              {allRecordsSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedRecordIds.length > 0 && (
            <button 
              onClick={handleBatchDelete} 
              className="btn btn-sm btn-error mr-2"
              disabled={isBatchDeleting} // Disable while deleting
            >
              {isBatchDeleting ? 'Deleting...' : `Delete Selected (${selectedRecordIds.length})`}
            </button>
          )}
          <button 
            onClick={handleSortToggle} 
            className="btn btn-sm btn-outline"
            disabled={isBatchDeleting} // Disable while deleting
          >
            Sort by Date ({sortOrder === 'asc' ? 'Oldest First' : 'Newest First'})
          </button>
          <Link href={`/groups/${groupId}/summary`} className="btn btn-success">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Summary
          </Link>
          <Link href={`/groups/${groupId}/periodic-records/create`} className="btn btn-primary">
            Create New Record
          </Link>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300 text-center py-8">No periodic records found for this group.</p>
      ) : (
        <ul className="space-y-4">
          {records.map((record) => (
            <li key={record.id} className="p-4 border rounded-lg shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary mr-3"
                    checked={selectedRecordIds.includes(record.id)}
                    onChange={() => handleSelectRecord(record.id)}
                    disabled={isBatchDeleting} // Disable while deleting
                  />
                  <Link href={`/groups/${groupId}/periodic-records/${record.id}`}>
                    <div className="font-semibold text-lg hover:underline text-gray-900 dark:text-gray-100">
                      Meeting #{record.recordSequenceNumber || 'N/A'} - {new Date(record.meetingDate).toLocaleDateString()}
                    </div>
                  </Link>
                </div>
                <div className="flex space-x-2">
                  <Link href={`/groups/${groupId}/periodic-records/${record.id}/edit`} className="btn btn-sm btn-outline">
                    Edit
                  </Link>
                  <button 
                    onClick={() => handleDelete(record.id)} 
                    className="btn btn-sm btn-outline btn-error"
                    disabled={isBatchDeleting} // Disable while deleting
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              {/* Financial Summary */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-600 shadow-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Meeting Details</h4>
                  <p className="text-blue-800 dark:text-blue-200">Members Present: {record.membersPresent ?? 'N/A'}</p>
                  <p className="text-blue-800 dark:text-blue-200">New Members: {record.newMembersJoinedThisPeriod ?? 0}</p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-600 shadow-sm">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Cash Position</h4>
                  <p className="text-green-800 dark:text-green-200">Cash in Hand: ₹{record.cashInHandAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-green-800 dark:text-green-200">Cash in Bank: ₹{record.cashInBankAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="font-semibold text-green-900 dark:text-green-100">Total Standing: ₹{record.totalGroupStandingAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg border border-purple-200 dark:border-purple-600 shadow-sm">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Period Income</h4>
                  <p className="text-purple-800 dark:text-purple-200">New Contributions: ₹{record.newContributionsThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-purple-800 dark:text-purple-200">Interest Earned: ₹{record.interestEarnedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-purple-800 dark:text-purple-200">Late Fines: ₹{record.lateFinesCollectedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-purple-800 dark:text-purple-200">Loan Processing Fees: ₹{record.loanProcessingFeesCollectedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                </div>
                
                <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-lg border border-orange-200 dark:border-orange-600 shadow-sm">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Period Summary</h4>
                  <p className="text-orange-800 dark:text-orange-200">Total Collection: ₹{record.totalCollectionThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-orange-800 dark:text-orange-200">Expenses: ₹{record.expensesThisPeriod?.toFixed(2) ?? 'N/A'}</p>
                  <p className="text-orange-800 dark:text-orange-200">Starting Balance: ₹{record.standingAtStartOfPeriod?.toFixed(2) ?? 'N/A'}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
