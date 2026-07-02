import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader,
  MessageSquare,
  PenTool,
  Send,
} from "lucide-react";
import { Branch } from "@/payload-types";
import ProgressTracker from "../ProgressTracker";

interface ImageGenerationStatusProps {
  message: Branch;
  onComplete?: () => void;
  className?: string;
}

type Step =
  | "receiving"
  | "creating_prompt"
  | "sending_to_ai"
  | "generating"
  | "complete"
  | "error";

const ImageGenerationStatus: React.FC<ImageGenerationStatusProps> = ({
  message,
  onComplete,
  className = "",
}) => {
  const loadingMessage =
    message && message.content
      ? message.content[0].loadingMessage
      : "receiving";
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isFading, setIsFading] = useState<boolean>(false);

  const steps: Step[] = [
    "receiving",
    "creating_prompt",
    "sending_to_ai",
    "generating",
    "complete",
  ];

  useEffect(() => {
    const stepIndex = steps.indexOf(loadingMessage as Step);
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex);
    }

    if (loadingMessage === "complete") {
      const fadeOutTimer = setTimeout(() => {
        setIsFading(true);
      }, 2000);

      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) {
          onComplete();
        }
      }, 3000);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [loadingMessage, onComplete]);

  const getStatusInfo = (step: Step) => {
    switch (step) {
      case "creating_prompt":
        return {
          icon: <PenTool className="h-5 w-5" />,
          title: "Creating Prompt",
          description: "Crafting the perfect description for your image...",
        };
      case "sending_to_ai":
        return {
          icon: <Send className="h-5 w-5" />,
          title: "Sending to AI",
          description: "Transmitting data to our AI...",
        };
      case "generating":
        return {
          icon: <Loader className="h-5 w-5 animate-spin" />,
          title: "Generating Image",
          description: "Our AI is bringing your image to life...",
        };
      case "complete":
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
          title: "Generation Complete",
          description: "Your image is ready!",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
          title: "Error Occurred",
          description: "We encountered an issue while processing your request.",
        };
      default:
        return {
          icon: <MessageSquare className="h-5 w-5" />,
          title: "Receiving Request",
          description: "Processing your input...",
        };
    }
  };

  const renderProgressSteps = () => (
    <div className="flex items-center justify-between mb-4">
      {steps.map((step, index) => {
        const { icon } = getStatusInfo(step);
        return (
          <div key={step} className="flex flex-col items-center">
            <div
              className={`rounded-full p-2 ${
                index <= currentStep
                  ? "bg-custom-logo-purple text-white dark:bg-blue-400 dark:text-gray-900"
                  : "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
              } transition-all duration-300 ease-in-out`}
            >
              {React.cloneElement(icon as React.ReactElement, {
                className: "h-5 w-5",
              })}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 w-full mt-2 ${
                  index < currentStep ? "bg-custom-logo-purple dark:bg-blue-400" : "bg-gray-300 dark:bg-gray-600"
                } transition-all duration-300 ease-in-out`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`space-y-4 p-4 bg-white dark:bg-gray-800 w-full rounded-lg shadow-md ${className}
        ${isFading ? "opacity-0" : "opacity-100"}
        transition-opacity duration-1000 ease-out`}
    >
      {renderProgressSteps()}

      <div
        className={`rounded-md p-4 ${
          loadingMessage === "error"
            ? "bg-red-100 border border-red-200 dark:bg-red-900 dark:border-red-700"
            : loadingMessage === "complete"
            ? "bg-green-100 border border-green-200 dark:bg-green-900 dark:border-green-700"
            : "bg-blue-100 border border-blue-200 dark:bg-blue-900 dark:border-blue-700"
        }`}
      >
        <div className="flex items-center">
          {getStatusInfo(loadingMessage as Step).icon}
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getStatusInfo(loadingMessage as Step).title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {getStatusInfo(loadingMessage as Step).description}
            </p>
          </div>
        </div>
        {message.progress && <ProgressTracker data={message.progress as unknown as {
            max: number;
            node: string;
            prompt_id: string;
            value: number;
        }} />}
      </div>
    </div>
  );
};

export default ImageGenerationStatus;