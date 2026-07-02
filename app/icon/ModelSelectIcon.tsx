import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const ModelSelectIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fillRule="evenodd" 
          d="m85 20h-70c-4.4 0-8 3.6-8 8v36c0 4.4 3.6 8 8 8h70c4.4 0 8-3.6 8-8v-36c0-4.4-3.6-8-8-8zm3 44c0 1.7-1.3 3-3 3h-70c-1.7 0-3-1.3-3-3v-36c0-1.7 1.3-3 3-3h70c1.7 0 3 1.3 3 3v36z"
        />
        <path 
          fillRule="evenodd" 
          d="m32 82h36c1.1 0 2 0.9 2 2s-0.9 2-2 2h-36c-1.1 0-2-0.9-2-2s0.9-2 2-2z"
        />
        <path 
          fillRule="evenodd" 
          d="m25 35h20c0.8 0 1.5 0.7 1.5 1.5v16c0 0.8-0.7 1.5-1.5 1.5h-20c-0.8 0-1.5-0.7-1.5-1.5v-16c0-0.8 0.7-1.5 1.5-1.5zm1.5 16h17v-13h-17v13z"
        />
        <path 
          fillRule="evenodd" 
          d="m55 35h20c0.8 0 1.5 0.7 1.5 1.5v16c0 0.8-0.7 1.5-1.5 1.5h-20c-0.8 0-1.5-0.7-1.5-1.5v-16c0-0.8 0.7-1.5 1.5-1.5zm1.5 16h17v-13h-17v13z"
        />
      </svg>
    </div>
  );
};