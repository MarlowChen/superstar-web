import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface CommentReaction {
  comment?: string;
  imageId: string;
}

interface CommentDialogProps {
  currentComment: CommentReaction;
  onConfirm: (commentData: CommentReaction) => void;
  onClose: () => void;
  isOpen: boolean;
}

const CommentDialog: React.FC<CommentDialogProps> = ({
  currentComment,
  onConfirm,
  onClose,
  isOpen,
}) => {
  const [comment, setComment] = useState("");
  const t = useTranslations("comment");

  useEffect(() => {
    if (isOpen) {
      setComment(currentComment.comment || "");
    }
  }, [isOpen, currentComment]);

  const handleConfirm = () => {
    onConfirm({
      imageId: currentComment.imageId,
      comment: comment.trim()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-[#2C3E50] dark:text-custom-white">
            {t("addComment")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-[#2C3E50] dark:text-custom-white" />
          </button>
        </div>
        <textarea
          className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-[#2C3E50] dark:text-custom-white focus:outline-none focus:ring-2 focus:ring-[#5944FF] focus:border-transparent"
          rows={5}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("writeComment")}
        />
        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-[#5944FF] hover:bg-[#4834E5] text-white rounded-lg transition-colors"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentDialog;