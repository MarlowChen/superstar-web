import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
  strokeWidth?: number; // 可自定義線條粗細
}

export const HomeIcon = ({ 
  className = "", 
  wrapperClassName = "",
  strokeWidth = 4 // 默認線條粗細
}: IconProps) => {
  const scale = 1.3;
  const centerX = 50;
  const centerY = 50;
  const translateX = centerX - centerX * scale;
  const translateY = centerY - centerY * scale;
  
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
          <path
            d="M50 15L18 42V85H40V60C40 58.3431 41.3431 57 43 57H57C58.6569 57 60 58.3431 60 60V85H82V42L50 15Z"
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M50 15L18 42"
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M82 42L50 15"
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};