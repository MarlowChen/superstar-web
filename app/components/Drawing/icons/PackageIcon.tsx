import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const PackageIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  const scale = 1.25;
  const centerX = 12.5;
  const centerY = 12.5;
  const translateX = centerX - centerX * scale;
  const translateY = centerY - centerY * scale;
  
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 25 25"
        fill="none"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
          <path 
            d="M12.5 13V22M12.5 13L4.5 8M12.5 13L20.5 8M8.5 5.5L16.5 10.5M4.5 8L12.5 3L20.5 8V17L12.5 22L4.5 17V8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};
