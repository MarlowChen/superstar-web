import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

export const useTermsAgreement = () => {
  const [hasAgreed, setHasAgreed] = useState(false);
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // 從 localStorage 讀取同意狀態
    const agreed = localStorage.getItem('termsAgreed');
    if (agreed === 'true') {
      setHasAgreed(true);
    }
  }, []);

  const handleAgree = () => {
    setHasAgreed(true);
    // setIsSidebarOpen(false);
    setIsDialogOpen(false);
    localStorage.setItem('termsAgreed', 'true');
    
    // 執行待處理的動作
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const checkTermsAgreement = (action: () => void) => {
    // 如果已登入，直接執行動作
    if (user) {
      action();
      return;
    }

    // 如果未登入且未同意條款，顯示側邊欄
    if (!hasAgreed) {
      setPendingAction(() => action);
      // setIsSidebarOpen(true);
      setIsDialogOpen(true);
      return;
    }

    // 如果未登入但已同意條款，直接執行動作
    action();
  };

  return {
    hasAgreed,
    // isSidebarOpen,
    // setIsSidebarOpen,
    isDialogOpen,
    setIsDialogOpen,
    handleAgree,
    checkTermsAgreement,
  };
}; 