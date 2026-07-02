import { createContext, useContext, useState, ReactNode } from 'react';

interface MenuVisibilityContextType {
  isMenuButtonVisible: boolean;
  setIsMenuButtonVisible: (visible: boolean) => void;
}

const MenuVisibilityContext = createContext<MenuVisibilityContextType | undefined>(undefined);

export function MenuVisibilityProvider({ children }: { children: ReactNode }) {
  const [isMenuButtonVisible, setIsMenuButtonVisible] = useState(true);

  return (
    <MenuVisibilityContext.Provider value={{ isMenuButtonVisible, setIsMenuButtonVisible }}>
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