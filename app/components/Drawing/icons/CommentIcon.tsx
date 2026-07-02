import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const CommentIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg 
        viewBox="0 0 100 100"
        className={`w-full h-full transition-all duration-300 ${className}`}
      >
        <path 
          fillRule="evenodd"
          d="M85 10H15c-5.5 0-10 4.5-10 10v45c0 5.5 4.5 10 10 10h15l15 15 15-15h25c5.5 0 10-4.5 10-10V20c0-5.5-4.5-10-10-10zM15 65V20h70v45H57.5L45 77.5 32.5 65H15z"
        />
        <path 
          fillRule="evenodd"
          d="M25 35h50v5H25zM25 45h35v5H25z"
        />
      </svg>
    </div>
  );
};