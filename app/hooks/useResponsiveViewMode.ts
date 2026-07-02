import { useState, useEffect } from 'react';

export type ViewMode = 'grid' | 'list';

/**
 * 響應式視圖模式 hook
 * 手機版/平板版: List | 桌面版: Grid
 */
export const useResponsiveViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const updateViewMode = () => {
      const isDesktop = window.innerWidth >= 1280; // xl 斷點
      setIsDesktop(isDesktop);
      setViewMode(isDesktop ? 'grid' : 'list');
    };

    updateViewMode();
    window.addEventListener('resize', updateViewMode);
    window.addEventListener('orientationchange', updateViewMode);
    
    return () => {
      window.removeEventListener('resize', updateViewMode);
      window.removeEventListener('orientationchange', updateViewMode);
    };
  }, []);

  return { viewMode, setViewMode, isDesktop };
};
