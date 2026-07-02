import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface ProgressData {
  max: number;
  node: string;
  prompt_id: string;
  value: number;
}

interface ProgressTrackerProps {
  data: ProgressData;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ data }) => {
  const [structureProgress, setStructureProgress] = useState(0);
  const [styleProgress, setStyleProgress] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsTimeout(true);
    }, 60000); // 30 seconds timeout
  };

  useEffect(() => {
    resetTimeout();

    if (data.node === "1") {
      setStructureProgress(prevProgress => Math.max(prevProgress, (data.value / data.max) * 100));
    } else if (data.node === "9") {
      setStyleProgress(prevProgress => Math.max(prevProgress, (data.value / data.max) * 100));
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data]);

  const isStructureComplete = structureProgress === 100;
  const isStyleComplete = styleProgress === 100;
  const totalProgress = (structureProgress + styleProgress) / 2;

  return (
    <div className="max-w-md mx-auto p-6 bg-none rounded-lg dark:bg-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-center dark:text-custom-white">
        AI Image Generation
      </h2>
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          <span className="text-2xl font-semibold">{totalProgress.toFixed(0)}%</span>
        </div>
      </div>
      
      {/* Structure Generation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium dark:text-custom-white">Structure Generation</span>
          <span className="text-sm font-medium dark:text-custom-white">{structureProgress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${structureProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Style Rendering */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium dark:text-custom-white">Style Rendering</span>
          <span className="text-sm font-medium dark:text-custom-white">{styleProgress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${styleProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="mt-6 flex items-center justify-between text-sm font-medium">
        <div className="flex items-center">
          {isStructureComplete ? (
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
          ) : isTimeout ? (
            <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
          ) : (
            <Circle className="w-5 h-5 mr-2 text-custom-logo-purple" />
          )}
          <span className="dark:text-custom-white">Structure</span>
        </div>
        <div className="flex items-center">
          {isStyleComplete ? (
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
          ) : isTimeout ? (
            <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
          ) : (
            <Circle className="w-5 h-5 mr-2 text-custom-logo-purple" />
          )}
          <span className="dark:text-custom-white">Style</span>
        </div>
      </div>
      {isTimeout && (
        <div className="mt-4 text-center text-sm text-yellow-500">
          Processing may be taking longer than expected. Please wait or try again later.
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;