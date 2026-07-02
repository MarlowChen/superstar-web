import React, { memo } from "react";
import { motion } from "framer-motion";

interface MessageActionsProps {
  copy?: () => void;
  retry?: () => void;
  like?: () => void;
  disLike?: () => void;
  edit?: () => void;
  comment?: () => void; // 新增取消功能
  share?: () => void; // 新增分享功能
  prev?: () => void;
  next?: () => void;
  cancel?: () => void; // 新增取消功能
  isFirstMessage?: boolean;
  isLastMessage?: boolean;
  isGenerating?: boolean; // 新增，用於控制取消按鈕的顯示
}

const MessageActions: React.FC<MessageActionsProps> = memo<MessageActionsProps>(
  ({
    copy,
    retry,
    like,
    disLike,
    edit,
    share,
    prev,
    next,
    comment,
    cancel, // 新增取消功能
    isFirstMessage,
    isLastMessage,
    isGenerating, // 新增
  }: MessageActionsProps) => {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.15,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="bg-custom-white dark:bg-[#3a444f] dark:text-custom-white text-gray-500  border border-[0.5px] border-custom-logo-purple dark:border-slate-700 dark:border-custom-white hover:border-custom-logo-purple-hover dark:hover:border-slate-700 flex items-center rounded-lg shadow-md p-0"
      >
        <div className="text-gray-300 flex items-stretch justify-between">
          <div className="flex gap-1 text-gray-500 dark:text-custom-white">
            {copy && (
              <ActionButton onClick={copy} icon={CopyIcon} text="Copy" />
            )}
            {retry && (
              <ActionButton onClick={retry} icon={RetryIcon} text="Retry" />
            )}
            {share && (
              <ActionButton onClick={share} icon={ShareIcon} text="Share" />
            )}
            {edit && (
              <ActionButton
                onClick={edit}
                icon={EditIcon}
                text="Edit"
                expandOnHover
              />
            )}
            {comment && (
              <ActionButton
                onClick={comment}
                icon={CommentIcon}
                text="Comment"
                expandOnHover
              />
            )}
            {isGenerating &&
              cancel && ( // 新增取消按鈕
                <ActionButton
                  onClick={cancel}
                  icon={CancelIcon}
                  text="Cancel"
                />
              )}
          </div>
          <div className="flex items-stretch gap-1 text-gray-500 dark:text-custom-white">
            {like && (
              <ActionButton
                onClick={like}
                icon={LikeIcon}
                title="Share positive feedback"
              />
            )}
            {disLike && (
              <ActionButton
                onClick={disLike}
                icon={DislikeIcon}
                title="Report issue"
              />
            )}
            {(prev || next) && (
              <div className="w-px h-4/5 self-center  mx-1"></div>
            )}
            {prev && (
              <ActionButton
                onClick={prev}
                icon={PrevIcon}
                disabled={isFirstMessage}
                className={
                  isFirstMessage ? "opacity-50 cursor-not-allowed" : ""
                }
              />
            )}
            {next && (
              <ActionButton
                onClick={next}
                icon={NextIcon}
                disabled={isLastMessage}
                className={isLastMessage ? "opacity-50 cursor-not-allowed" : ""}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isGenerating === nextProps.isGenerating &&
      prevProps.isFirstMessage === nextProps.isFirstMessage &&
      prevProps.isLastMessage === nextProps.isLastMessage
    );
  }
);

const ActionButton: React.FC<{
  onClick?: () => void;
  icon: React.FC<{ className?: string }>;
  text?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  expandOnHover?: boolean;
}> = ({
  onClick,
  icon: Icon,
  text,
  title,
  disabled,
  className,
  expandOnHover,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05, opacity: 0.6 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.1 }}
      onClick={onClick}
      disabled={disabled}
      title={title || text}
      className={`flex flex-row items-center gap-1 rounded-md p-1.5 text-xs transition-all ${
        disabled ? "opacity-50" : "hover:bg-[#eaebeb] dark:hover:bg-[#232e39]"
      } ${className}`}
    >
      <Icon className="w-4 h-4" />
      {text && (
        <span
          className={`${
            expandOnHover ? "w-0 overflow-hidden group-hover:w-auto" : ""
          } transition-all duration-200`}
        >
          {text}
        </span>
      )}
    </motion.button>
  );
};

// Icon components remain unchanged
const CopyIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"></path>
  </svg>
);

const RetryIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L44.59,96H72a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V56a8,8,0,0,1,16,0V85.8L60.25,60A96,96,0,0,1,224,128Z"></path>
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path>
  </svg>
);

const LikeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z"></path>
  </svg>
);

const DislikeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Zm150,21.29a7.88,7.88,0,0,1-6,2.71H152a8,8,0,0,0-8,8v24a24,24,0,0,1-19.29,23.54L88,150.11V56H204a8,8,0,0,1,7.94,7l12,96A7.87,7.87,0,0,1,222,165.29Z"></path>
  </svg>
);

const CommentIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78.69.69,0,0,0,.13-.11L82.5,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM216,192H82.5a16,16,0,0,0-10.3,3.75l-.12.11L40,224V64H216Z" />
    <path d="M152,104a12,12,0,1,1-12-12A12,12,0,0,1,152,104Z" />
    <path d="M200,104a12,12,0,1,1-12-12A12,12,0,0,1,200,104Z" />
    <path d="M104,104a12,12,0,1,1-12-12A12,12,0,0,1,104,104Z" />
  </svg>
);

const PrevIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path>
  </svg>
);

const ShareIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-88,88,8,8,0,0,1-16,0A104,104,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66Z" />
  </svg>
);

const NextIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>
  </svg>
);

// 新增 CancelIcon 組件
const CancelIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
  </svg>
);

MessageActions.displayName = "MessageActions";
export default MessageActions;
