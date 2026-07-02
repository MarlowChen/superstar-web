import React from "react";
import { useTranslations } from "next-intl";

interface UpgradeButtonProps {
  isCollapsed: boolean;
  setOpenPaymentModel: (open: boolean) => void;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({
  isCollapsed,
  setOpenPaymentModel,
}) => {
  const t = useTranslations("navigation");
  
  return (
    <div>
      <button
        onClick={() => {
          setOpenPaymentModel(true);
        }}
        className={`
          ${isCollapsed ? 'h-11 w-11 p-2' : 'h-12 px-3.5 py-2.5'} 
          text-left w-full flex items-center justify-center transition-all duration-300 
          bg-[#6d5bd0] text-white
          font-medium rounded-2xl shadow-[0_10px_24px_rgba(109,91,208,0.22)] 
          hover:bg-[#5f4ec2] hover:shadow-[0_14px_28px_rgba(109,91,208,0.28)]
          overflow-hidden relative group
          active:scale-[0.98]
        `}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_55%)] opacity-70"></div>

        <div className={`
          ${isCollapsed ? 'w-full' : 'w-6 flex-shrink-0'} 
          flex items-center justify-center relative
        `}>
          <svg 
            className={`
              ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} 
              transition-all duration-300 group-hover:scale-110
            `} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        
        {!isCollapsed && (
          <div className="relative ml-2 flex min-w-0 flex-1 flex-col transition-all duration-300">
            <span className="truncate text-sm font-semibold leading-tight">
              {t("upgrade_to_pro")}
            </span>
            <span className="mt-0.5 text-[11px] text-white/78">
              Unlock more models
            </span>
          </div>
        )}

        {isCollapsed && (
          <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#f8d66d] opacity-90"></div>
        )}
      </button>
    </div>
  );
};

export default UpgradeButton;
