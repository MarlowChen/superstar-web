import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const HeartIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        fill="currentColor"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fill="currentColor"
          fillRule="evenodd"
          d="M86.6 13.4c-4.9-4.9-11.5-7.6-18.5-7.6s-13.5 2.7-18.5 7.7L47.1 16l-2.6-2.6C39.6 8.5 33 5.8 26 5.8s-13.5 2.7-18.4 7.6C2.7 18.3 0 24.8 0 31.8s2.7 13.5 7.7 18.5L45.2 87.8c0.5 0.5 1.2 0.8 1.9 0.8s1.4-0.3 1.9-0.8l37.7-37.6c4.9-4.9 7.7-11.5 7.7-18.5S91.5 18.3 86.6 13.4zM82.8 46.5L47.1 82.1 11.5 46.6c-3.9-3.9-6.1-9.1-6.1-14.7s2.1-10.7 6.1-14.6c3.9-3.9 9.1-6.1 14.6-6.1s10.8 2.2 14.7 6.1l4.5 4.5c1.1 1.1 2.8 1.1 3.8 0l4.5-4.5c3.9-3.9 9.1-6.1 14.7-6.1s10.7 2.2 14.6 6.1c3.9 3.9 6.1 9.1 6.1 14.7S86.7 42.6 82.8 46.5z"
        />
      </svg>
    </div>
  );
};
