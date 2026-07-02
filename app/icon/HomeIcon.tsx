import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const HomeIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 

        viewBox="0 0 100 100" 
        className={`w-full h-full transition-all duration-300  ${className}`}
      >
        {/* 房屋主體 */}
        <path 
          strokeWidth={0.5}
          fillRule="evenodd" 
          d="M50 10L10 45h10v45h60V45h10L50 10zM30 90V55h40v35H30z"
        />
        
        {/* 屋頂細節 */}
        <path 
          fillRule="evenodd" 
          strokeWidth={0.5}
          d="M50 20L20 45h60L50 20zM40 65h20v25H40V65z"
        />
        
        {/* 門 */}
        <path 
          fillRule="evenodd" 
          strokeWidth={0.5}
          d="M45 75h10v15H45V75z"
        />
        
        {/* 門把手 */}
        <circle 
        strokeWidth={0.5}
          cx="52" 
          cy="82" 
          r="2"
        />
      </svg>
    </div>
  );
};