import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const MoreIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fillRule="evenodd" 
          d="m46.9 100c-1.9-0.3-3.7-0.4-5.5-0.8-12.3-2.2-22.3-8.1-30.2-17.7-5.9-7.2-9.6-15.5-10.7-24.8-1.9-14.6 1.9-27.7 11.4-39 7.3-8.7 16.6-14.4 27.8-16.6 17.8-3.5 33.2 1.3 46.1 14.1 7.7 7.7 12.2 17.2 13.8 28.1 0.1 1.2 0.3 2.4 0.4 3.6q0 3.1 0 6.2c-0.1 0.3-0.1 0.5-0.2 0.8-0.5 7.7-2.7 14.9-6.7 21.4-8 13.1-19.5 21.1-34.5 23.9-1.8 0.4-3.7 0.6-5.5 0.8q-3.1 0-6.2 0zm3.1-4.1c-25.4 0-45.9-20.5-45.9-45.9 0-25.4 20.5-45.9 45.9-45.9 25.3 0 45.8 20.5 45.8 45.9 0 25.4-20.5 45.9-45.8 45.9z"
        />
        <path 
          fillRule="evenodd" 
          d="m25 54.1c-2.3 0-4.2-1.8-4.2-4.1 0-2.3 1.9-4.1 4.2-4.1 2.3 0 4.1 1.8 4.1 4.1 0 2.3-1.8 4.1-4.1 4.1z"
        />
        <path 
          fillRule="evenodd" 
          d="m50 54.1c-2.3 0-4.2-1.8-4.2-4.1 0-2.3 1.9-4.1 4.2-4.1 2.3 0 4.1 1.8 4.1 4.1 0 2.3-1.8 4.1-4.1 4.1z"
        />
        <path 
          fillRule="evenodd" 
          d="m75 54.1c-2.3 0-4.1-1.8-4.1-4.1 0-2.3 1.8-4.1 4.1-4.1 2.3 0 4.1 1.8 4.1 4.1 0 2.3-1.8 4.1-4.1 4.1z"
        />
      </svg>
    </div>
  );
};