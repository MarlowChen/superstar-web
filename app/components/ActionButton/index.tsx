import React from "react";
import { motion } from "framer-motion";

export const ActionButton: React.FC<{
    onClick: (e: React.MouseEvent) => void;
    icon: React.FC<{ className?: string }>;
    title?: string;
    isActive?: boolean;
    activeColor?: string;
  }> = ({
    onClick,
    icon: Icon,
    title,
    isActive,
    activeColor = "text-custom-logo-purple",
  }) => {
    return (
      <motion.button
        whileHover={{ scale: 1.05, opacity: 0.6 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.1 }}
        onClick={onClick}
        title={title}
        className={`flex flex-row items-center gap-1 rounded-md p-1.5 text-xs transition-all 
          hover:bg-[#eaebeb] dark:hover:bg-[#232e39]`}
      >
        <Icon
          className={`w-4 h-4 ${
            isActive
              ? `${activeColor} dark:${activeColor} fill-current`
              : "text-gray-500 dark:text-custom-white"
          }`}
        />
      </motion.button>
    );
  };