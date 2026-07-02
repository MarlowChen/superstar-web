import { useState, useCallback } from 'react';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loadingText?: string;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirmDialog = useCallback((
    options: ConfirmDialogOptions,
    onConfirm: () => void | Promise<void>
  ) => {
    setDialogState({
      ...options,
      isOpen: true,
      onConfirm: async () => {
        try {
          setDialogState(prev => ({ ...prev, isLoading: true }));
          await onConfirm();
        } finally {
          setDialogState(prev => ({ ...prev, isLoading: false, isOpen: false }));
        }
      },
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    dialogState,
    showConfirmDialog,
    closeDialog,
  };
}; 