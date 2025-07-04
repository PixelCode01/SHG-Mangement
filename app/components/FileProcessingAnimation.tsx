import { useState, useEffect } from 'react';

interface FileProcessingAnimationProps {
  isProcessing: boolean;
  currentStage?: number;
}

const stages = [
  "Loading document",
  "Analyzing file structure",
  "Extracting member data",
  "Validating data format",
  "Preparing results"
];

const FileProcessingAnimation: React.FC<FileProcessingAnimationProps> = ({ 
  isProcessing, 
  currentStage = 0 
}) => {
  const [progress, setProgress] = useState(0);

  // Animate progress bar
  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      return;
    }

    const timer = setInterval(() => {
      setProgress(prevProgress => {
        // Calculate target progress based on current stage
        const stageEnd = (currentStage + 1) * 20;
        const targetProgress = Math.min(stageEnd - 2, 98); // Don't quite reach 100% until complete

        if (prevProgress < targetProgress) {
          return prevProgress + 1;
        }
        return prevProgress;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isProcessing, currentStage]);

  // When processing is complete, quickly reach 100%
  useEffect(() => {
    if (!isProcessing && progress > 0) {
      const timer = setTimeout(() => {
        setProgress(100);
      }, 200);
      return () => clearTimeout(timer);
    }
    return undefined; // Explicit return for consistency
  }, [isProcessing, progress]);

  if (!isProcessing && progress === 0) return null;

  return (
    <div className="processing-container">
      <h3 className="processing-heading">Processing File</h3>
      
      {/* Progress bar */}
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Current stage indicator */}
      <div className="stage-indicator">
        {currentStage < stages.length ? stages[currentStage] : 'Complete'}
      </div>
      
      {/* Animation of file processing */}
      <div className="animation-container">
        <div className="relative">
          {/* Document icon */}
          <div className="document-icon">
            <div className="document-line" style={{ top: '0.5rem', left: '0.25rem', width: '2rem' }}></div>
            <div className="document-line" style={{ top: '1rem', left: '0.25rem', width: '1.5rem' }}></div>
            <div className="document-line" style={{ top: '1.5rem', left: '0.25rem', width: '2rem' }}></div>
            <div className="document-line" style={{ top: '2rem', left: '0.25rem', width: '1.25rem' }}></div>
          </div>
          
          {/* Animated scanning line */}
          <div 
            className="scan-line"
            style={{ 
              animation: isProcessing ? 'scan 1.5s infinite ease-in-out' : 'none',
              transform: `translateY(${(progress % 20) / 20 * 3}rem)`
            }}
          ></div>
        </div>
        
        {/* Processing arrows */}
        <div className="arrow">→</div>
        
        {/* Data extraction visualization */}
        <div className="flex flex-col items-start">
          <div className="data-line" style={{ width: progress > 20 ? '2.5rem' : '0' }}></div>
          <div className="data-line" style={{ width: progress > 40 ? '2rem' : '0' }}></div>
          <div className="data-line" style={{ width: progress > 60 ? '3rem' : '0' }}></div>
          <div className="data-line" style={{ width: progress > 80 ? '1.5rem' : '0' }}></div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(12px); }
          100% { transform: translateY(0); }
        }
        
        .processing-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 0.5rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          margin-bottom: 1rem;
          margin-top: 0.5rem;
        }
        
        .processing-heading {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .progress-bar-container {
          width: 100%;
          height: 0.5rem;
          background-color: #e5e7eb;
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }
        
        .progress-bar {
          height: 100%;
          background-color: #2563eb;
          transition: width 200ms ease-out;
        }
        
        .stage-indicator {
          font-size: 0.875rem;
          color: #4b5563;
          margin-bottom: 0.5rem;
        }
        
        .animation-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 4rem;
          margin-top: 0.5rem;
        }
        
        .document-icon {
          width: 2.5rem;
          height: 3rem;
          border: 2px solid #9ca3af;
          border-radius: 0.125rem;
          position: relative;
          background-color: white;
        }
        
        .document-line {
          position: absolute;
          height: 0.25rem;
          background-color: #d1d5db;
          border-radius: 0.125rem;
        }
        
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 2.5rem;
          height: 0.25rem;
          background-color: #3b82f6;
          opacity: 0.7;
        }
        
        .arrow {
          margin: 0 0.75rem;
          color: #3b82f6;
          font-size: 1.25rem;
          animation: pulse 1.5s infinite;
        }
        
        .data-line {
          height: 0.5rem;
          background-color: #3b82f6;
          border-radius: 9999px;
          margin-bottom: 0.25rem;
          transition: width 300ms ease-in;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default FileProcessingAnimation;
