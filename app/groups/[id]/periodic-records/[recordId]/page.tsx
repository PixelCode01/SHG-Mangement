// /home/pixel/SHG/app/groups/[id]/periodic-records/[recordId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PeriodicRecordForm, { PeriodicRecordFormValues } from '@/app/components/PeriodicRecordForm';
import type { CollectionFrequency } from '@prisma/client'; // Corrected import

// --- Local Interfaces for API Data ---
interface MemberLoan {
  id: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  dateIssued: string;
}
interface MemberForForm {
  id: string;
  name: string;
  initialLoanAmount?: number;
  loans?: MemberLoan[];
}
interface GroupForForm {
  id: string;
  name: string;
  collectionFrequency: CollectionFrequency;
  members: (MemberForForm & {
    initialShareAmount?: number;
    initialLoanAmount?: number;
    initialInterest?: number;
    currentLoanBalance?: number;
  })[];
}

interface GroupPeriodicRecordDetailClient extends Omit<PeriodicRecordFormValues, 'meetingDate'> {
  id: string;
  meetingDate: string; // API returns string, form expects Date
  // memberRecords are already in PeriodicRecordFormValues structure
}
// --- End Local Interfaces ---

export default function PeriodicRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const recordId = params.recordId as string;

  const [record, setRecord] = useState<GroupPeriodicRecordDetailClient | null>(null);
  const [group, setGroup] = useState<GroupForForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !recordId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const groupRes = await fetch(`/api/groups/${groupId}`);
        if (!groupRes.ok) throw new Error('Failed to fetch group details');
        const groupData: GroupForForm = await groupRes.json();
        setGroup(groupData);

        const recordRes = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`);
        if (!recordRes.ok) throw new Error('Failed to fetch periodic record');
        const rawRecordData = await recordRes.json(); // Renamed to rawRecordData

        // API now returns processed data with loan balances and member names already calculated
        // No additional processing needed as the server handles loan balance calculation
        setRecord(rawRecordData as GroupPeriodicRecordDetailClient);
      } catch (err) {
        const typedError = err as Error;
        setError(typedError.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [groupId, recordId]);

  const handleSubmit = async (data: PeriodicRecordFormValues) => {
    if (!groupId || !recordId) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const payload: Partial<PeriodicRecordFormValues> = {
      ...data,
      meetingDate: data.meetingDate instanceof Date ? data.meetingDate : new Date(data.meetingDate),
      memberRecords: data.memberRecords.map(mr => ({
        ...mr,
        compulsoryContribution: mr.compulsoryContribution ? Number(mr.compulsoryContribution) : 0,
        loanRepaymentPrincipal: mr.loanRepaymentPrincipal ? Number(mr.loanRepaymentPrincipal) : 0,
        lateFinePaid: mr.lateFinePaid ? Number(mr.lateFinePaid) : 0,
      })),
    };

    try {
      const res = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update periodic record');
      }
      const updatedRecordData: GroupPeriodicRecordDetailClient = await res.json();
      setRecord(updatedRecordData);
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      const typedError = err as Error;
      setSubmitError(typedError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!groupId || !recordId || !window.confirm("Are you sure you want to delete this record?")) return;
    setError(null); // Clear previous general errors
    setSubmitError(null); // Clear previous submission errors
    try {
      const res = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete periodic record');
      }
      router.push(`/groups/${groupId}/periodic-records`);
      router.refresh();
    } catch (err) {
      const typedError = err as Error;
      setSubmitError(typedError.message); // Display delete error
    }
  };

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  if (!record || !group) return <div className="container mx-auto p-4">Record or Group not found.</div>;

  const membersForForm = group.members ? group.members.map(m => ({ id: m.id, name: m.name })) : [];

  // Prepare recordToEdit for the form, converting meetingDate string to Date object
  const recordToEditForForm = record ? {
    ...record,
    meetingDate: new Date(record.meetingDate),
  } : undefined;

  const getFrequencyLabel = (frequency?: CollectionFrequency): string => {
    if (!frequency) return 'Periodic';
    switch (frequency) {
      case 'WEEKLY': return 'Weekly';
      case 'FORTNIGHTLY': return 'Fortnightly';
      case 'MONTHLY': return 'Monthly';
      case 'YEARLY': return 'Yearly';
      default: return 'Periodic';
    }
  };

  const frequencyLabel = getFrequencyLabel(group.collectionFrequency);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit' : 'View'} {frequencyLabel} Record for {group?.name}
        </h1>
        <div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="mr-2 bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            disabled={isEditing || isSubmitting}
          >
            Delete
          </button>
        </div>
      </div>

      <Link href={`/groups/${groupId}/periodic-records`} className="text-blue-600 hover:underline mb-4 block">&larr; Back to All {frequencyLabel} Records</Link>

      {submitError && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {submitError}</p>}

      {isEditing && group && recordToEditForForm ? (
        <PeriodicRecordForm
          groupId={groupId}
          groupName={group.name}
          groupFrequency={group.collectionFrequency}
          members={membersForForm}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
          isLoading={isSubmitting}
          recordToEdit={recordToEditForForm}
        />
      ) : (
        <div className="space-y-4 bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-gray-900 dark:text-gray-100">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Record Summary</h3> {/* Changed class to className */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <p><strong>Meeting Date:</strong> {record?.meetingDate ? new Date(record.meetingDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Record Sequence No.:</strong> {record?.recordSequenceNumber ?? 'N/A'}</p>
            <p><strong>Standing at Start:</strong> ₹{record?.standingAtStartOfPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Total Collection:</strong> ₹{record?.totalCollectionThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Expenses:</strong> ₹{record?.expensesThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Loan Processing Fees:</strong> ₹{record?.loanProcessingFeesCollectedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>New Contributions:</strong> ₹{record?.newContributionsThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Interest Earned:</strong> ₹{record?.interestEarnedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Late Fines Collected:</strong> ₹{record?.lateFinesCollectedThisPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Cash in Hand (End):</strong> ₹{record?.cashInHandAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p><strong>Cash in Bank (End):</strong> ₹{record?.cashInBankAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
            <p className="font-semibold text-lg">Total Group Standing (End): ₹{record?.totalGroupStandingAtEndOfPeriod?.toFixed(2) ?? 'N/A'}</p>
          </div>

          {record?.memberRecords && record.memberRecords.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Member Details for this Period</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Member Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Loan Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contribution</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Loan Repay (Principal)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Late Fine</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {record.memberRecords.map(mr => {
                      const memberDetails = membersForForm.find((m: { id: string; name: string }) => m.id === mr.memberId);
                      return (
                        <tr key={mr.memberId}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{mr.memberName || memberDetails?.name || mr.memberId}</td>
                          <td className="px-4 py-2 text-sm">₹{(mr.memberCurrentLoanBalance || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm">₹{mr.compulsoryContribution?.toFixed(2) ?? '0.00'}</td>
                          <td className="px-4 py-2 text-sm">₹{mr.loanRepaymentPrincipal?.toFixed(2) ?? '0.00'}</td>
                          <td className="px-4 py-2 text-sm">₹{mr.lateFinePaid?.toFixed(2) ?? '0.00'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
