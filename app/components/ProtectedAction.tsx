import React from 'react';
import { useTermsAgreement } from '../hooks/useTermsAgreement';
// import TermsSidebar from './TermsSidebar';
import CopyrightNoticeDialog from './CopyrightNoticeDialog';

interface ProtectedActionProps {
  children: React.ReactNode;
  onAction: () => void;
}

const ProtectedAction: React.FC<ProtectedActionProps> = ({ children, onAction }) => {
  const {
    // isSidebarOpen,
    // setIsSidebarOpen,
    isDialogOpen,
    setIsDialogOpen,
    // handleAgree,
    checkTermsAgreement,
    handleAgree,
  } = useTermsAgreement();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    checkTermsAgreement(onAction);
  };

  return (
    <>
      <div onClick={handleClick}>
        {children}
      </div>

      {/* <TermsSidebar
        // isOpen={isSidebarOpen}
        // onClose={() => setIsSidebarOpen(false)}
        // onAgree={handleAgree}
      /> */}
      <CopyrightNoticeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAgree={handleAgree}
      />
    </>
  );
};

export default ProtectedAction; 