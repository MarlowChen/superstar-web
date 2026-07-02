"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MenuVisibilityContextType {
  isMenuButtonVisible: boolean;
  setIsMenuButtonVisible: (visible: boolean) => void;
  hideMenuButton: () => void;
  showMenuButton: () => void;
  toggleMenuButtonVisibility: () => void;
}

const MenuVisibilityContext = createContext<MenuVisibilityContextType | undefined>(undefined);

interface MenuVisibilityProviderProps {
  children: React.ReactNode;
  initialVisible?: boolean;
}

export function MenuVisibilityProvider({ 
  children, 
  initialVisible = true 
}: MenuVisibilityProviderProps) {
  const [isMenuButtonVisible, setIsMenuButtonVisible] = useState(initialVisible);

  const hideMenuButton = useCallback(() => {
    setIsMenuButtonVisible(false);
  }, []);

  const showMenuButton = useCallback(() => {
    setIsMenuButtonVisible(true);
  }, []);

  const toggleMenuButtonVisibility = useCallback(() => {
    setIsMenuButtonVisible(prev => !prev);
  }, []);

  const contextValue: MenuVisibilityContextType = {
    isMenuButtonVisible,
    setIsMenuButtonVisible,
    hideMenuButton,
    showMenuButton,
    toggleMenuButtonVisibility,
  };

  return (
    <MenuVisibilityContext.Provider value={contextValue}>
      {children}
    </MenuVisibilityContext.Provider>
  );
}

export function useMenuVisibility() {
  const context = useContext(MenuVisibilityContext);
  if (context === undefined) {
    throw new Error('useMenuVisibility must be used within a MenuVisibilityProvider');
  }
  return context;
}