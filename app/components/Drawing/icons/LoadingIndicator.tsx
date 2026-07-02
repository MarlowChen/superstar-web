type Size = 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  className?: string;
  wrapperClassName?: string;
}

interface LoadingIndicatorProps {
  size?: Size;
  message?: string;
  className?: string;
}

const LoadingSpinner = ({
    className = "",
    wrapperClassName = ""
  }: LoadingSpinnerProps) => {
    return (
      <div className={`inline-block ${wrapperClassName}`}>
        <svg 
          viewBox="0 0 100 100" 
          className={`w-full h-full ${className}`}
        >
          {[...Array(12)].map((_, i) => {
            const opacity = (12 - i) / 12;
            return (
              <line
                key={i}
                x1="50"
                y1="15"
                x2="50"
                y2="30"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                transform={`rotate(${i * 30} 50 50)`}
                style={{ opacity }} // 使用內聯樣式控制不透明度
              />
            );
          })}
        </svg>
      </div>
    );
  };
  

const sizeClasses: Record<Size, string> = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16"
};

const LoadingIndicator = ({ 
  size = "md", 
  message,
  className = ""
}: LoadingIndicatorProps) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${sizeClasses[size]} animate-spin ${className}`}>
        <LoadingSpinner className="text-gray-600" />
      </div>
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

const LoadingModal = ({ isOpen, message }: LoadingModalProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 min-w-[200px] flex items-center justify-center">
        <LoadingIndicator 
          size="lg" 
          message={message}
        />
      </div>
    </div>
  );
};

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  size?: Size;
}

const LoadingButton = ({ 
  loading = false, 
  children, 
  size = "sm",
  className = "",
  ...props 
}: LoadingButtonProps) => {
  return (
    <button 
      className={`px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 ${className}`}
      disabled={loading}
      {...props}
    >
      {loading && <LoadingIndicator size={size} />}
      {children}
    </button>
  );
};

export type { 
  Size, 
  LoadingSpinnerProps, 
  LoadingIndicatorProps, 
  LoadingModalProps, 
  LoadingButtonProps 
};

export { 
  LoadingSpinner, 
  LoadingIndicator, 
  LoadingModal, 
  LoadingButton 
};