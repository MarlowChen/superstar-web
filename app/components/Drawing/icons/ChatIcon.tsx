import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const ChatIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fillRule="evenodd" 
          d="m50 5c24.2 0 43.8 17.6 43.8 39.4 0 21.7-19.6 39.4-43.8 39.4-7.2 0-14-1.6-20-4.4-5.9 3.9-12.9 6.5-20.4 7.2-1.8 0.2-3.8-1.1-3.4-3.1 1.4-7 4.3-13.1 8.3-18.4-5.3-6-8.3-13.4-8.3-21.3 0-21.8 19.6-38.8 43.8-38.8zm0 71.8c20.3 0 36.8-14.5 36.8-32.4s-16.5-32.4-36.8-32.4-36.8 14.5-36.8 32.4c0 6.9 2.8 13.3 7.5 18.5 1 1.1 1.2 2.5 0.6 3.9-2.5 5.4-6.7 10.2-12 13.7 5.7-0.3 11.1-1.9 15.9-4.7 1-0.5 2.1-0.6 3.2-0.2 6.3 3 13.5 4.8 21.1 4.8h0.5z"
        />
        <path 
          fillRule="evenodd" 
          d="m35 42c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5z"
        />
        <path 
          fillRule="evenodd" 
          d="m50 42c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5z"
        />
        <path 
          fillRule="evenodd" 
          d="m65 42c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5z"
        />
      </svg>
    </div>
  );
};