"use client";

import React from "react";

import LoginDialog from "@/app/components/LoginDialog";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
}

const LoginV2Dialog: React.FC<LoginDialogProps> = (props) => {
  return <LoginDialog {...props} />;
};

export default LoginV2Dialog;
