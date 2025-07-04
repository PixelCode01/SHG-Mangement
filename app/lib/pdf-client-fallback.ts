// Simple client-side PDF text extraction fallback
export async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Try to extract basic text using simple string matching
        // This is a fallback method for when server-side processing fails
        const uint8Array = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(uint8Array);
        
        // Clean and extract readable text from PDF data
        // Look for common PDF text patterns
        const textMatches = text.match(/\((.*?)\)/g) || [];
        const extractedText = textMatches
          .map(match => match.replace(/[()]/g, ''))
          .filter(text => text.length > 1 && /[A-Za-z]/.test(text))
          .join('\n');
        
        console.log('Client-side extracted text length:', extractedText.length);
        console.log('Sample extracted text:', extractedText.substring(0, 200));
        
        if (extractedText.length > 10) {
          resolve(extractedText);
        } else {
          // Fallback: Try alternative extraction methods
          const alternativeText = text
            .replace(/[^\x20-\x7E\n]/g, ' ') // Keep only printable ASCII
            .split(/\s+/)
            .filter(word => word.length > 2 && /[A-Za-z]/.test(word))
            .join(' ');
          
          resolve(alternativeText);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read PDF file'));
    reader.readAsArrayBuffer(file);
  });
}
