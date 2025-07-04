// /home/pixel/SHG/app/groups/[id]/bank-transactions/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useParams } from 'next/navigation';

interface BankTransaction {
  id: string;
  transactionDate: string; // Keep as string for form input, convert to Date for sorting
  particulars: string;
  amount: number;
  remainingBalance: number;
}

interface Group {
    id: string;
    name: string;
}

type SortOrder = 'asc' | 'desc'; // Added for sorting

export default function BankTransactionsListPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // Added for sorting by date

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTransactionData, setNewTransactionData] = useState<Partial<Omit<BankTransaction, 'id'>>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const groupRes = await fetch(`/api/groups/${groupId}`);
      if (!groupRes.ok) throw new Error('Failed to fetch group details');
      const groupData = await groupRes.json();
      setGroup(groupData);

      const transRes = await fetch(`/api/groups/${groupId}/bank-transactions`);
      if (!transRes.ok) throw new Error('Failed to fetch bank transactions');
      const transData = await transRes.json();
      // Sort initial data
      transData.sort((a: BankTransaction, b: BankTransaction) => {
        const dateA = new Date(a.transactionDate).getTime();
        const dateB = new Date(b.transactionDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
      setTransactions(transData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  }, [groupId, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSortToggle = () => {
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newSortOrder);
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = new Date(a.transactionDate).getTime();
      const dateB = new Date(b.transactionDate).getTime();
      return newSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    setTransactions(sortedTransactions);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewTransactionData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newTransactionData.transactionDate || !newTransactionData.particulars || newTransactionData.amount === undefined || newTransactionData.remainingBalance === undefined) {
        setCreateError("All fields are required.");
        return;
    }
    try {
      const res = await fetch(`/api/groups/${groupId}/bank-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransactionData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create transaction');
      }
      setShowCreateForm(false);
      setNewTransactionData({});
      fetchData(); // Refresh the list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An unknown error occurred while creating transaction');
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
        const res = await fetch(`/api/groups/${groupId}/bank-transactions/${transactionId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to delete transaction');
        }
        fetchData(); // Refresh list
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting transaction');
    }
  };

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error && !group) return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  if (!group) return <div className="container mx-auto p-4">Group not found.</div>;

  return (
    <div className="container mx-auto p-4 bg-white dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bank Transactions for {group.name}</h1>
        <button onClick={handleSortToggle} className="btn btn-sm btn-outline">
          Sort by Date ({sortOrder === 'asc' ? 'Oldest First' : 'Newest First'})
        </button>
      </div>
      {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-400 dark:border-red-700/50 rounded">Error: {error}</div>}

      <div className="mb-4">
        <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary mb-4"
        >
          {showCreateForm ? 'Cancel' : 'Add New Transaction'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="mb-6 p-4 border rounded shadow-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
          <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">New Bank Transaction</h2>
          {createError && <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded">{createError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <input type="datetime-local" name="transactionDate" id="transactionDate" onChange={handleInputChange} value={newTransactionData.transactionDate || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100" required />
            </div>
            <div>
              <label htmlFor="particulars" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Particulars</label>
              <input type="text" name="particulars" id="particulars" onChange={handleInputChange} value={newTransactionData.particulars || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100" required />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount (+/-)</label>
              <input type="number" name="amount" id="amount" step="0.01" onChange={handleInputChange} value={newTransactionData.amount || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100" required />
            </div>
            <div>
              <label htmlFor="remainingBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Remaining Balance</label>
              <input type="number" name="remainingBalance" id="remainingBalance" step="0.01" onChange={handleInputChange} value={newTransactionData.remainingBalance || ''} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100" required />
            </div>
          </div>
          <button type="submit" className="mt-4 btn-primary">Save Transaction</button>
        </form>
      )}

      {transactions.length === 0 && !showCreateForm ? (
        <p className="text-gray-600 dark:text-gray-400">No bank transactions found for this group yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-left text-gray-900 dark:text-gray-100">Date</th>
                <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-left text-gray-900 dark:text-gray-100">Particulars</th>
                <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-right text-gray-900 dark:text-gray-100">Amount</th>
                <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-right text-gray-900 dark:text-gray-100">Balance</th>
                <th className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-left text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((trans) => (
                <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">{new Date(trans.transactionDate).toLocaleString()}</td>
                  <td className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">{trans.particulars}</td>
                  <td className={`py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-right ${trans.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>₹{trans.amount.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b border-gray-200 dark:border-gray-600 text-right text-gray-900 dark:text-gray-100">₹{trans.remainingBalance.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b border-gray-200 dark:border-gray-600">
                    {/* Edit link can be added here if an edit page is created */}
                    {/* <Link href={`/groups/${groupId}/bank-transactions/${trans.id}/edit`} className="text-blue-500 hover:underline mr-2">Edit</Link> */}
                    <button onClick={() => handleDelete(trans.id)} className="text-red-500 dark:text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <div className="mt-8">
          <Link href={`/groups/${groupId}`} className="text-blue-600 hover:underline">
            &larr; Back to Group Details
          </Link>
      </div>
    </div>
  );
}
