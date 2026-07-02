import React from 'react';

interface IconProps {
  className?: string;
  wrapperClassName?: string;
}

export const ImageEditIcon = ({ className = "", wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
              <svg 
          viewBox="0 0 100 100"
          className={`w-full h-full transition-all duration-300 ${className}`}
        >
          <path 
            fillRule="evenodd" 
            d="M83.33 12.5C85.55 12.5 87.5 14.36 87.5 16.67V23.97L79.17 32.3V20.83H20.83V54.58L37.5 37.92L55.53 55.95L49.64 61.84L37.5 49.7L20.83 66.37V79.17H64.72L67.67 79.17L73.21 73.63L78.75 79.17H79.17V67.58L87.5 59.25V83.33C87.5 85.55 85.55 87.5 83.33 87.5H16.67C14.36 87.5 12.5 85.55 12.5 83.33V16.67C12.5 14.36 14.36 12.5 16.67 12.5H83.33ZM90.74 32.53L96.67 38.46L64.22 70.83L58.33 70.83L58.33 64.94L90.74 32.53ZM64.58 29.17C67.14 29.17 70.83 32.86 70.83 37.5C70.83 42.14 67.14 45.83 64.58 45.83C62.02 45.83 58.33 42.14 58.33 37.5C58.33 32.86 62.02 29.17 64.58 29.17Z"
          />
        </svg>
    </div>
  );
};
