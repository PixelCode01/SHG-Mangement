'use client';

import { useState } from 'react';

export default function PDFTestPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🚀 Testing PDF upload:', file.name);
      
      // Use production-safe client-side extraction + server-side processing
      console.log('🔄 Using production-safe PDF processing...');
      
      const reader = new FileReader();
      const textContent = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const text = decoder.decode(uint8Array);
            
            // Extract text from PDF data using simple pattern matching
            const textMatches = text.match(/\((.*?)\)/g) || [];
            const extractedText = textMatches
              .map(match => match.replace(/[()]/g, ''))
              .filter(text => text.length > 1 && /[A-Za-z]/.test(text))
              .join('\n');
            
            console.log('🔄 Client-side extracted text length:', extractedText.length);
            resolve(extractedText.length > 10 ? extractedText : text.replace(/[^\x20-\x7E\n]/g, ' '));
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsArrayBuffer(file);
      });

      // Send extracted text to production-safe server endpoint
      const response = await fetch('/api/pdf-text-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textContent,
          fileName: file.name,
          fileSize: file.size
        })
      });

      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Response:', data);

      setResult(data);

      // Process members like the main component does
      if (data.members && Array.isArray(data.members)) {
        console.log('🔍 Processing members...');
        
        const processedMembers = data.members.map((member: { name?: string; 'loan amount'?: string; email?: string; phone?: string }, index: number) => {
          const name = member.name || '';
          const rawLoanAmount = member['loan amount'];
          const parsedLoanAmount = parseInt(rawLoanAmount || '0');
          
          if (index < 5) {
            console.log(`  Member ${index + 1}: "${name}" - Raw: "${rawLoanAmount}" -> Parsed: ${parsedLoanAmount}`);
          }
          
          return {
            name,
            loanAmount: parsedLoanAmount,
            email: member.email || '',
            phone: member.phone || '',
          };
        });

        const membersWithLoans = processedMembers.filter((m: { loanAmount: number }) => m.loanAmount > 0).length;
        const totalLoanAmount = processedMembers.reduce((sum: number, m: { loanAmount: number }) => sum + m.loanAmount, 0);
        
        console.log(`📊 Final statistics: ${processedMembers.length} members, ${membersWithLoans} with loans, ₹${totalLoanAmount.toLocaleString()} total`);
      }

    } catch (err) {
      console.error('❌ Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">PDF Parser Test</h1>
      
      <div className="mb-4">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={loading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {loading && (
        <div className="text-blue-600">Processing PDF...</div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Results</h2>
          
          {result.statistics && (
            <div className="bg-green-50 p-3 rounded mb-4">
              <h3 className="font-semibold">Statistics:</h3>
              <ul>
                <li>Total members: {result.statistics.totalMembers}</li>
                <li>Members with loans: {result.statistics.membersWithLoans}</li>
                <li>Total loan amount: ₹{result.statistics.totalLoanAmount.toLocaleString()}</li>
              </ul>
            </div>
          )}

          {result.members && (
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-semibold mb-2">First 5 Members:</h3>
              <ul className="space-y-1">
                {result.members.slice(0, 5).map((member: { name?: string; 'loan amount'?: string }, index: number) => (
                  <li key={index} className="text-sm">
                    {member.name} - ₹{parseInt(member['loan amount'] || '0').toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
