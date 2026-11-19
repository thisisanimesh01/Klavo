import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Badge } from "./ui";
import { useOnboarding } from "../context/OnboardingContext";
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Layout,
  Layers,
  FileText,
  BarChart2,
  Users,
} from "lucide-react";

export default function ProductWalkthroughModal() {
  const {
    activeTourStep,
    steps,
    nextTourStep,
    prevTourStep,
    closeTour,
    dismissOnboarding,
  } = useOnboarding();

  const navigate = useNavigate();
  const triggerRef = useRef(null);

  if (activeTourStep === null || activeTourStep < 0 || activeTourStep >= steps.length) {
    return null;
  }

  const currentStep = steps[activeTourStep];
  const isFirst = activeTourStep === 0;
  const isLast = activeTourStep === steps.length - 1;

  const getStepIcon = (id) => {
    switch (id) {
      case "welcome":
        return <Compass size={28} className="text-indigo-400" />;
      case "create_workspace":
        return <Users size={28} className="text-blue-400" />;
      case "create_project":
        return <Layout size={28} className="text-emerald-400" />;
      case "manage_tasks":
        return <Layers size={28} className="text-amber-400" />;
      case "collaborate_documents":
        return <FileText size={28} className="text-purple-400" />;
      case "view_analytics":
        return <BarChart2 size={28} className="text-cyan-400" />;
      default:
        return <Compass size={28} className="text-indigo-400" />;
    }
  };

  const handleAction = () => {
    if (currentStep.route) {
      navigate(currentStep.route);
    }
    nextTourStep();
  };

  return (
    <Modal
      isOpen={activeTourStep !== null}
      onClose={closeTour}
      title=""
      size="md"
      className="max-w-lg"
    >
      <div className="space-y-5 py-2">
        {/* Header Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              {getStepIcon(currentStep.id)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="xs">
                  Step {activeTourStep + 1} of {steps.length}
                </Badge>
                <span className="text-[11px] text-slate-400 capitalize">
                  {currentStep.category}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {currentStep.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {currentStep.description}
        </div>

        {/* Step Progress Tracker Dots */}
        <div className="flex items-center justify-center gap-2 py-1" aria-label="Walkthrough progress">
          {steps.map((s, idx) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-200 ${
                idx === activeTourStep
                  ? "w-7 bg-indigo-600"
                  : idx < activeTourStep
                  ? "w-2 bg-emerald-500"
                  : "w-2 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={dismissOnboarding}
            className="text-xs text-slate-400 hover:text-slate-200 transition py-1"
          >
            Skip walkthrough
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={prevTourStep}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleAction}
              className="flex items-center gap-1.5"
            >
              {isLast ? (
                <>
                  Finish <CheckCircle2 size={14} />
                </>
              ) : (
                <>
                  {currentStep.actionLabel || "Next"} <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
