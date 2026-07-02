"use client";

import React, { useEffect, useRef, useState } from "react";

import AuthPanel from "@/app/components/Auth/AuthPanel";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
}

const LoginDialog: React.FC<LoginDialogProps> = ({
  isOpen,
  onClose,
  callbackUrl,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
      return;
    }

    document.body.style.overflow = "unset";
    const timer = window.setTimeout(() => setIsVisible(false), 250);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        ref={dialogRef}
        className={`relative w-full max-w-5xl transition-all duration-300 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <AuthPanel
          variant="dialog"
          callbackUrl={callbackUrl}
          onSuccess={onClose}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white transition hover:bg-white/20"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default LoginDialog;
