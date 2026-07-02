import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TitleEditDialogProps {
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const TitleEditDialog: React.FC<TitleEditDialogProps> = ({
  currentTitle,
  onConfirm,
  onClose,
  isOpen,
}) => {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, title, isOpen]);

  const handleConfirm = () => {
    if (title.trim()) {
      onConfirm(title.trim());
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.05 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            {/* Header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
            >
              <div className="flex items-center space-x-2 w-full">
                <span className="text-custom-black font-bold">Edit Title</span>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="p-4"
            >
              <motion.input
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-[33px] px-3 bg-custom-white text-custom-black border border-[0.5px] border-custom-logo-purple rounded-xl focus:outline-none focus:border-custom-logo-purple-hover transition-colors"
                placeholder="請輸入新標題"
                autoFocus
              />
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex justify-end space-x-2 px-4 py-3 border-t border-gray-100"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className="px-4 py-2 text-sm text-white bg-custom-logo-purple hover:bg-custom-logo-purple-hover rounded-md transition-colors"
              >
                Confirm
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TitleEditDialog;