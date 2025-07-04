'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface MemberData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  // Add any other fields you expect from the member details API
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Form state
  const [name, setName] = useState('');
   
  const [_email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }

    if (status === 'authenticated' && session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
      
      // If the user has a memberId, fetch the member details
      if (session.user.memberId) {
        fetchMemberDetails(session.user.memberId);
      }
      
      setIsLoading(false);
    }
  }, [session, status, router]);

  const fetchMemberDetails = async (memberId: string) => {
    try {
      const response = await fetch(`/api/members/${memberId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch member details');
      }
      const memberData = await response.json();
      setMemberData(memberData);
    } catch (error) {
      console.error('Error fetching member details:', error);
      setError('Could not load member details');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setError('');
    setSuccessMessage('');
    
    // Validate passwords match if trying to change password
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setSuccessMessage('Profile updated successfully');
      
      // Update local session data
      router.refresh(); // This will trigger a refetch of the session
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred while updating your profile');
    }
  };

  const handleLinkMember = async () => {
    router.push('/profile/link-member');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">My Profile</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Account Information</h2>
          <div className="mb-4 text-gray-700 dark:text-gray-300">
            <div className="mb-3">
              <p className="font-medium mb-1">Role:</p>
              <div className="flex items-center">
                {session?.user?.role === 'ADMIN' && (
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                    Administrator
                  </span>
                )}
                {session?.user?.role === 'GROUP_LEADER' && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    Group Leader
                  </span>
                )}
                {session?.user?.role === 'MEMBER' && (
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Member
                  </span>
                )}
              </div>
            </div>
            <p className="mb-3"><strong>Email:</strong> {session?.user?.email || 'N/A'}</p>
            <div>
              <p className="font-medium mb-1">Member Status:</p>
              {session?.user?.memberId ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded">
                  <p className="font-medium">Linked to Member Account</p>
                  {memberData && (
                    <div className="mt-2 p-2 bg-white rounded border border-green-100">
                      <p className="font-medium">{memberData.name}</p>
                      <p className="text-sm text-green-700">Member ID: {memberData.id}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded flex items-center justify-between">
                  <span>Not linked to any member account</span>
                  <button 
                    onClick={() => router.push('/profile/link-member')}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-1 px-3 rounded"
                  >
                    Link Now
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mt-6 mb-3 text-gray-900 dark:text-white">Update Profile</h3>
          <form onSubmit={handleProfileUpdate}>
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="name">
                Name
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"                
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="currentPassword">
                Current Password (required for password change)
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="newPassword">
                New Password (leave blank to keep current)
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Update Profile
            </button>
          </form>
        </div>
        
        {memberData ? (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Linked Member Details</h2>
            <div className="text-gray-700 dark:text-gray-300">
              <p><strong>Name:</strong> {memberData.name}</p>
              <p><strong>Email:</strong> {memberData.email || 'Not provided'}</p>
              <p><strong>Phone:</strong> {memberData.phone || 'Not provided'}</p>
              <p><strong>Address:</strong> {memberData.address || 'Not provided'}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Link to Member Profile</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your user account is not yet linked to a member profile. Linking allows you to manage group activities associated with that member.
            </p>
            <button
              onClick={handleLinkMember}
              className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded"
            >
              Link to Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
