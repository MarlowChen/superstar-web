"use client";
import React, { useState } from "react";
import LoraModelSelection from "../LoraModelSelection";
import type { LoraModel } from "@/payload-types";
import ModelDetailsDialog from "../ModelDialog";
import { useRouter } from "next/navigation";

const LoraModel: React.FC = () => {
  const router = useRouter();
  // 🆕 用於詳情對話框的獨立模型狀態
  const [modelForDetails, setModelForDetails] = useState<LoraModel | null>(null);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const toggleSelectedModel = (model: LoraModel) => {
    // 只設置詳情對話框的模型
    setModelForDetails(model);
    setShowModelDetails(true);
  };
  return (
    <>
      <div >
        <LoraModelSelection
          onSelectModel={(model: LoraModel) => {
            router.push(`/drawing/?modelId=${model.id}`);
          }}
          toggleSelectedModel={toggleSelectedModel}
        />
      </div>
      <ModelDetailsDialog
        isOpen={showModelDetails}
        onClose={function (): void {
          setShowModelDetails(false);
        }}
        model={modelForDetails}
      />
    </>
  );
};

export default LoraModel;
