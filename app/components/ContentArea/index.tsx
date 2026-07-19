"use client";

import React, { useState, useEffect, useRef } from "react";
import { LoraModel } from "@/payload-types";
import LoraModelSelection from "../LoraModelSelection";
import { Info, X } from "lucide-react";
import ModelDialog from "../ModelDialog";
import DrawerModelSelector from "../DrawerModelSelector";
import { useSearchParams } from "next/navigation";


const ContentArea: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<LoraModel | null>(null);
  // 🆕 新增：用於詳情對話框的獨立模型狀態
  const [modelForDetails, setModelForDetails] = useState<LoraModel | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  useEffect(() => {
    const modelId = searchParams.get("modelId");
    if (modelId) {
      fetchModel(modelId);
    }
  }, [searchParams]);

  const fetchModel = async (modelId: string) => {
    try {
      const response = await fetch(
        `/api/models/${encodeURIComponent(modelId)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      setSelectedModel(data as LoraModel);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  const handleAsk = async () => {
    if (query.trim() === "" || isComposing || !canSubmit) return;
    try {
      const response = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "chat",
          prompt: query,
          message: query,
          modelId: selectedModel?.id,
          loraId: selectedModel?.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to create conversation");


    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || "";
    setQuery(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !isComposing && canSubmit) {
      // event.preventDefault();
      // handleAsk();
    }
  };

  const handleSelectModel = (model: LoraModel) => {
    setSelectedModel(model);
    setIsModelSelectorOpen(false);
  };

  // const handleClickOutside = useCallback(
  //   (e: React.MouseEvent<HTMLDivElement>) => {
  //     if (e.target === e.currentTarget) {
  //       setIsModelSelectorOpen(false);
  //     }
  //   },
  //   []
  // );

  const toggleSelectedModel = (model: LoraModel) => {
    // 只設置詳情對話框的模型，不影響當前選中的模型
    setModelForDetails(model);
    setShowModelDetails(true);
  };
  // const canSubmit = query.trim() !== "" && selectedModel !== null;
  const canSubmit = query.trim() !== "";
  return (
    <div className="flex flex-col flex-1 overflow-auto h-screen dark:bg-[#343b42]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 m-auto w-full">
        <h1 className="text-3xl font-bold mb-8 text-gray-500 dark:text-gray-300">
        What are you imagining?
        </h1>

        <div className="flex flex-col bg-custom-white dark:bg-[#3a444f] gap-1.5 border border-[0.5px] border-custom-logo-purple dark:border-slate-700 dark:border-custom-white hover:border-custom-logo-purple-hover dark:hover:border-slate-700 p-4 -mx-1 sm:mx-0 items-stretch transition-all duration-200 relative shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.035)] focus-within:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.075)] hover:border-custom-logo-purple-hover border-slate-700 focus-within:border-custom-logo-purple dark:focus-within:border-slate-700 cursor-text z-10 rounded-2xl">
          <div className="flex flex-row justify-between">
            <div className="relative flex-1">
              <div
                ref={inputRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                className="min-h-[50px] max-h-[200px] overflow-y-auto text-gray-500 dark:text-gray-300 outline-none"
                data-placeholder="Describe your idea in a few simple words…"
              />
              {query === "" && (
                <div className="absolute top-0 left-0 text-gray-400 pointer-events-none">
                  Describe your idea in a few simple words…
                </div>
              )}
            </div>

            <button
              onClick={handleAsk}
              className={`
          transition-all duration-100 ease-in-out
          inline-flex items-center justify-center
          bg-custom-logo-purple text-custom-white font-medium
          h-10 w-10 rounded-xl
          hover:bg-custom-logo-purple-hover active:scale-95
          focus:outline-none focus:ring-2 focus:ring-blue-300
          disabled:opacity-50 disabled:pointer-events-none
          ${
            canSubmit
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-0 translate-y-4"
          }
        `}
              disabled={!canSubmit}
              aria-label="Send Message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"></path>
              </svg>
            </button>
          </div>

          <div className="flex justify-start items-center mt-4">
            <button
              onClick={() => setIsModelSelectorOpen(true)}
              className="inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-custom-white dark:ring-offset-[#1A2633] ring-[#5944FF] focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none hover:bg-[#E6E8EB] dark:hover:bg-[#2C3E50] hover:border-[#5944FF] border-0.5 text-[#2C3E50] dark:text-custom-white inline-flex items-start gap-[0.175em] self-start rounded-md border-transparent text-sm opacity-80 transition hover:opacity-100 disabled:!opacity-80 sm:pb-1.5 sm:pl-1.5 sm:pr-1 sm:pt-1"
              data-testid="model-selector-dropdown"
              type="button"
              id="radix-:ru:"
              aria-haspopup="menu"
              aria-expanded="false"
              data-state="closed"
            >
              <div className="font-tiempos inline-flex gap-[4px] text-[14px] leading-none">
                <div className="whitespace-nowrap tracking-tight">
                  {selectedModel ? selectedModel.title : "Select Model"}
                </div>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                fill="currentColor"
                viewBox="0 0 256 256"
                className="text-[#6C7A89] dark:text-[#8F7FFF] ml-px shrink-0 translate-y-px"
              >
                <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
              </svg>
            </button>
            {selectedModel && (
              <>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="bg-custom-logo-purple ml-2 p-1 rounded-full hover:bg-custom-logo-purple-hover text-custom-white"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelectedModel(selectedModel);
                  }}
                  className="bg-custom-logo-purple ml-2 p-1 rounded-full hover:bg-custom-logo-purple-hover text-custom-white"
                >
                  <Info size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 mb-4 text-center">
            <p className="text-sm text-custom-black">Copyright © 2025 Hondolab Inc. <br/> “Please note that AI generation is random and unpredictable. Do not use it to infringe copyrights.”</p>
          </div>
      </div>
      {/* {isModelSelectorOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex justify-center items-center"
          onClick={handleClickOutside}
        >
          <div
            className="bg-custom-white dark:bg-[#3a444f] rounded-lg w-11/12 h-5/6 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-600 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-500 dark:text-gray-300">
                Select Lora Model
              </h2>
              <button
                onClick={() => setIsModelSelectorOpen(false)}
                className="text-custom-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              312
            </div>
          </div>
        </div>
      )} */}

      <DrawerModelSelector
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
      >
        <LoraModelSelection
          onSelectModel={handleSelectModel}
          toggleSelectedModel={toggleSelectedModel}
        />
      </DrawerModelSelector>
      {/* {selectedModel && (
        <div className="mt-2 p-2 bg-[#2a2b2d] rounded flex items-center justify-between">
          <span className="text-custom-white">
            Current: {selectedModel.title}
          </span>
          <button
            onClick={() => setShowModelDetails(!showModelDetails)}
            className="ml-2 p-1 rounded-full hover:bg-[#3a3b3d] text-white"
          >
            <Info size={18} />
          </button>
          <button
            onClick={() => setSelectedModel(null)}
            className="ml-2 p-1 rounded-full hover:bg-[#3a3b3d] text-white"
          >
            <X size={18} />
          </button>
        </div>
      )} */}
      {/* {showModelDetails && selectedModel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
          onClick={() => setShowModelDetails(false)}
        >
          <div
            className="bg-[#2a2b2d] rounded-lg w-11/12 max-w-2xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-600 flex justify-between items-center">
              <h2 className="text-xl font-bold text-custom-white">
                Model Details
              </h2>
              <button
                onClick={() => setShowModelDetails(false)}
                className="text-custom-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <ModelDetails model={selectedModel} />
            </div>
          </div>
        </div>
      )} */}
      <ModelDialog
        isOpen={showModelDetails}
        onClose={() => {
          setShowModelDetails(false);
        }}
        model={modelForDetails}
      />
    </div>
  );
};

export default ContentArea;
