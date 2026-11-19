import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useOnboarding } from "../context/OnboardingContext";
import { Card, CardHeader, Button, Badge } from "./ui";
import {
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  ArrowRight,
} from "lucide-react";

export default function OnboardingChecklist({ userRole = "member" }) {
  const {
    state,
    steps,
    startTour,
    completeStep,
    dismissOnboarding,
    resumeOnboarding,
    restartOnboarding,
  } = useOnboarding();

  const [collapsed, setCollapsed] = useState(false);

  // Filter steps relevant to the user's role
  const visibleSteps = steps.filter((step) =>
    step.targetRole.includes(userRole.toLowerCase())
  );

  const completedCount = visibleSteps.filter((step) =>
    (state.completedSteps || []).includes(step.id)
  ).length;

  const totalCount = visibleSteps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllComplete = completedCount === totalCount && totalCount > 0;

  // If dismissed or fully completed and not actively viewed, show subtle resume pill
  if (state.dismissed) {
    return (
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 text-xs">
        <div className="flex items-center gap-2 text-indigo-400">
          <Compass size={16} />
          <span className="font-medium">Onboarding is currently hidden.</span>
          <span className="text-slate-400">({completedCount}/{totalCount} steps completed)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resumeOnboarding}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
          >
            Resume checklist
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-950 shadow-md">
      <CardHeader className="pb-3 border-b border-indigo-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Compass size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  Getting Started with Klavo
                </h3>
                <Badge
                  variant={isAllComplete ? "success" : "primary"}
                  size="xs"
                >
                  {isAllComplete ? "Completed" : `${completedCount}/${totalCount} completed`}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Follow these essential milestones to ramp up your workspace and workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => startTour(0)}
              title="Launch interactive walkthrough"
              className="text-indigo-400 hover:text-indigo-300"
            >
              <Play size={13} className="mr-1" /> Guided Tour
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand checklist" : "Collapse checklist"}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={dismissOnboarding}
              title="Dismiss onboarding checklist"
              className="text-slate-400 hover:text-rose-400"
            >
              <X size={15} />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      {!collapsed && (
        <div className="p-4 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {visibleSteps.map((step, idx) => {
              const isDone = (state.completedSteps || []).includes(step.id);
              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-3 ${
                    isDone
                      ? "bg-slate-900/30 border-slate-800 text-slate-400"
                      : "bg-slate-900/60 border-slate-700/60 text-slate-200 hover:border-indigo-500/40"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => completeStep(step.id)}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-400 transition"
                      title={isDone ? "Mark incomplete" : "Mark complete"}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-medium truncate ${
                            isDone ? "line-through text-slate-500" : "text-slate-200"
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <Link
                      to={step.route}
                      className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-medium text-[11px] flex items-center gap-1 transition"
                    >
                      Open <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={restartOnboarding}
              className="hover:text-slate-200 flex items-center gap-1 transition text-[11px]"
            >
              <RotateCcw size={12} /> Reset progress
            </button>
            <span className="text-[11px]">
              {isAllComplete
                ? "🎉 You've finished all onboarding milestones!"
                : `${totalCount - completedCount} milestones remaining`}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
