import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const GuideIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fillRule="evenodd" 
          d="m50 100.2c-27.7 0-50-22.4-50-50.1 0-27.7 22.3-50.1 50-50.1 27.7 0 50 22.4 50 50.1 0 27.7-22.3 50.1-50 50.1zm0-6.3c-24.2 0-43.7-19.6-43.7-43.8 0-24.2 19.5-43.8 43.7-43.8 24.2 0 43.7 19.6 43.7 43.8 0 24.2-19.5 43.8-43.7 43.8z"
        />
        <path 
          fillRule="evenodd" 
          d="m53.1 62.6c0 5.1 0.1 10.1 0 15.2 0 2.6-2 4.2-4.2 3.4-1.5-0.6-2-1.9-2-3.4q0-4.6 0-9.3-0.1-10.4 0-20.9c0-2.1 1-3.5 2.6-3.7 2.1-0.3 3.6 1.1 3.6 3.6 0.1 5 0 10 0 15.1z"
        />
        <path 
          fillRule="evenodd" 
          d="m50 31.3c-3.4 0-6.2-2.8-6.2-6.2 0-3.5 2.8-6.3 6.2-6.3 3.4 0 6.2 2.8 6.2 6.3 0 3.4-2.8 6.2-6.2 6.2z"
        />
      </svg>
    </div>
  );
};
