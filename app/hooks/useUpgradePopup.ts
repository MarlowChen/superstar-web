"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";

interface UseUpgradePopupReturn {
  isPopupOpen: boolean;
  showPopup: () => void;
  forceShowPopup: () => void; // 強制顯示，不檢查任何條件
  hidePopup: () => void;
  shouldShowPopup: boolean;
  currentPoint: number; // 當前剩餘點數
}

export const useUpgradePopup = (): UseUpgradePopupReturn => {
  const { user, userPoint, point } = useAuth();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupCount, setPopupCount] = useState(0); // 追蹤今天已顯示的次數

  // 監控 isPopupOpen 的變化
  useEffect(() => {

  }, [isPopupOpen]);

  // 檢查是否應該顯示彈窗（基本條件檢查）
  const shouldShowPopup = useCallback(() => {
    // 首先檢查用戶是否已登入
    if (!user) {
      return false;
    }

    if (!userPoint) {
      return false;
    }

    // 如果已經付費，不顯示
    // 當 pointType 為 undefined 時，假設為免費用戶
    if (userPoint?.pointType && userPoint.pointType !== "FREE") {
      return false;
    }

    // 如果今天已經顯示過3次，不顯示
    if (popupCount >= 3) {
      return false;
    }

    return true;
  }, [user, userPoint, popupCount]);

  // 顯示彈窗
  const showPopup = useCallback(() => {
    if (shouldShowPopup()) {
      setIsPopupOpen(true);
      
      // 使用函數式更新，確保狀態正確
      setPopupCount(prev => {
        const newCount = prev + 1;
        
        // 將今天已顯示的次數存到 localStorage
        const today = new Date().toDateString();
        localStorage.setItem("upgradePopupCount", newCount.toString());
        localStorage.setItem("upgradePopupDate", today);
                
        return newCount;
      });
    }
  }, [shouldShowPopup]);

  // 強制顯示彈窗（用於手動測試和觸發）
  const forceShowPopup = useCallback(() => {

    setIsPopupOpen(true);
    // 狀態更新是異步的，所以這裡看到的還是舊值
    setTimeout(() => {
      // console.log('🚀 After setTimeout - isPopupOpen should be true now');
    }, 0);
  }, []);

  // 隱藏彈窗
  const hidePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  // 檢查今天是否已經顯示過彈窗
  useEffect(() => {
    const today = new Date().toDateString();
    const lastShownDate = localStorage.getItem("upgradePopupDate");
    const lastShownCount = localStorage.getItem("upgradePopupCount");
    
    if (lastShownDate === today) {
      const count = parseInt(lastShownCount || "0", 10);
      setPopupCount(count);
    } else {
      setPopupCount(0);
    }
    
    // 開發模式下，可以清除今天的顯示記錄來測試
    if (process.env.NODE_ENV === 'development' && window.location.search.includes('clearPopup=true')) {
      localStorage.removeItem("upgradePopupCount");
      localStorage.removeItem("upgradePopupDate");
      setPopupCount(0);
      // console.log('Cleared popup shown status for testing');
    }
  }, []);

  useEffect(() => {
    const handleCreationStart = () => {
      if (!userPoint) {
        return;
      }
      
      // 只在點數用完時提醒，避免低點數狀態反覆打斷創作流程
      const currentPoint = Number(userPoint.points ?? point ?? 0);
  
      if (currentPoint <= 0 && popupCount === 0) {
        showPopup();
      } else {
        // console.log('❌ 不觸發彈窗:', {
        //   reason: currentPoint >= 3 ? '點數>=3' : 
        //           currentPoint >= 2 ? '點數>=2' : 
        //           currentPoint > 1 ? '點數>1' :
        //           popupCount !== 0 && popupCount !== 1 && popupCount !== 2 ? `顯示次數不符(${popupCount})` : '其他原因'
        // });
      }
    };

    // 監聽自定義事件（需要在創作組件中觸發）
    window.addEventListener('creationStart', handleCreationStart);
    
    return () => {
      window.removeEventListener('creationStart', handleCreationStart);
    };
  }, [point, popupCount, showPopup, userPoint]);


  return {
    isPopupOpen,
    showPopup,
    forceShowPopup,
    hidePopup,
    shouldShowPopup: shouldShowPopup(),
    currentPoint: Number(userPoint?.points ?? point ?? 0),
  };
};
