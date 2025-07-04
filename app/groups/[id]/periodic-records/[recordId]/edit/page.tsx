'use client';

import PeriodicRecordForm from '@/app/components/PeriodicRecordForm';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CollectionFrequency } from '@prisma/client';
import type { PeriodicRecordFormValues } from '@/app/components/PeriodicRecordForm';

// Updated PeriodicRecord type to better align with form needs and potential API response
type FetchedPeriodicRecord = Partial<Omit<PeriodicRecordFormValues, 'meetingDate' | 'memberRecords'>> & {
  id: string;
  meetingDate?: string | Date; // API might return string, form needs Date
  cashInHandAtEndOfPeriod?: number | null;
  cashInBankAtEndOfPeriod?: number | null;
  expensesThisPeriod?: number | null;
  loanProcessingFeesCollectedThisPeriod?: number | null;
  newMembersJoinedThisPeriod?: number | null;
  sharePerMemberThisPeriod?: number | null;
  standingAtStartOfPeriod?: number | null;
  recordSequenceNumber?: number | null;
  memberRecords?: Array<{ // Added to include memberRecords from the API
    id: string;
    memberId: string;
    memberName?: string;
    compulsoryContribution?: number | null;
    loanRepaymentPrincipal?: number | null;
    loanRepaymentInterest?: number | null;
    lateFinePaid?: number | null;
    member?: { // Assuming member details might be nested
      id: string;
      name: string;
    };
  }>;
};

// Placeholder for group data structure
type GroupData = {
  name: string;
  frequency: CollectionFrequency;
  members: { id: string; name: string }[];
};

async function getPeriodicRecord(groupId: string, recordId: string): Promise<FetchedPeriodicRecord | null> {
  if (!groupId || !recordId) return null;
  try {
    const response = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`);
    if (!response.ok) {
      console.error(`Failed to fetch periodic record ${recordId} for group ${groupId}: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return { ...data, memberRecords: data.memberRecords || [] };
  } catch (error) {
    console.error(`Error fetching periodic record ${recordId} for group ${groupId}:`, error);
    return null;
  }
}

// Function to fetch group data
async function getGroupData(groupId: string): Promise<GroupData | null> {
  if (!groupId) return null;
  try {
    const response = await fetch(`/api/groups/${groupId}`);
    if (!response.ok) {
      console.error(`Failed to fetch group data for ${groupId}: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return {
      name: data.name,
      frequency: data.collectionFrequency,
      members: data.members || [],
    };
  } catch (error) {
    console.error(`Error fetching group data for ${groupId}:`, error);
    return null;
  }
}

export default function EditPeriodicRecordPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const recordId = params.recordId as string;

  const [record, setRecord] = useState<FetchedPeriodicRecord | null>(null);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [loadingPageData, setLoadingPageData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groupId && recordId) {
      setLoadingPageData(true);
      setError(null);
      Promise.all([
        getPeriodicRecord(groupId, recordId),
        getGroupData(groupId),
      ])
        .then(([recordData, grpData]) => {
          if (!recordData) {
            setError(prev => prev ? `${prev} Record not found.` : 'Record not found.');
          }
          if (!grpData) {
            setError(prev => prev ? `${prev} Group data not found.` : 'Group data not found.');
          }
          setRecord(recordData);
          setGroupData(grpData);
        })
        .catch((err) => {
          console.error('Failed to fetch data:', err);
          setError('Failed to load page data. Please try again.');
        })
        .finally(() => setLoadingPageData(false));
    }
  }, [groupId, recordId]);

  const handleSubmit = async (formData: PeriodicRecordFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        meetingDate: formData.meetingDate.toISOString(),
      };
      const response = await fetch(`/api/groups/${groupId}/periodic-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update record');
      }
      router.push(`/groups/${groupId}/periodic-records`);
    } catch (err) {
      console.error('Error updating record:', err);
      const typedError = err as Error;
      setError(`Failed to update record. ${typedError.message || ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPageData) {
    return <p className="container mx-auto p-4">Loading page data...</p>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href={`/groups/${groupId}/periodic-records`} className="btn btn-link">
          Back to Records
        </Link>
      </div>
    );
  }

  if (!record || !groupData) {
    return (
      <div className="container mx-auto p-4">
        <p>Record or essential group data could not be loaded.</p>
        <Link href={`/groups/${groupId}/periodic-records`} className="btn btn-link">
          Back to Records
        </Link>
      </div>
    );
  }

  const recordToEditForForm: Partial<PeriodicRecordFormValues> = record ? {
    ...record,
    meetingDate: record.meetingDate ? new Date(record.meetingDate) : new Date(),
    sharePerMemberThisPeriod: record.sharePerMemberThisPeriod ?? 0,
    memberRecords: record.memberRecords?.map(memberRecord => ({
      memberId: memberRecord.memberId,
      memberName: memberRecord.memberName ?? memberRecord.member?.name ?? '',
      compulsoryContribution: memberRecord.compulsoryContribution ?? 0,
      loanRepaymentPrincipal: memberRecord.loanRepaymentPrincipal ?? 0,
      lateFinePaid: memberRecord.lateFinePaid ?? 0,
      memberCurrentLoanBalance: 0, // Will be populated from group init data
    })) ?? [],
  } : {};

  return (
    <div className="container mx-auto p-4">
      <PeriodicRecordForm
        groupId={groupId}
        groupName={groupData.name}
        groupFrequency={groupData.frequency}
        members={groupData.members}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isLoading={isSubmitting}
        recordToEdit={recordToEditForForm}
      />
    </div>
  );
}
