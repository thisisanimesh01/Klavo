import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import {
  getOnboardingState,
  updateOnboardingState,
  resetOnboardingState,
} from "../api/onboardingApi";

const OnboardingContext = createContext(null);

export const ONBOARDING_WORKFLOW_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Klavo",
    category: "general",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/",
    description: "Klavo is your high-performance workspace for agile project management, real-time documents, and engineering metrics.",
  },
  {
    id: "create_workspace",
    title: "Setup Your Workspace",
    category: "setup",
    targetRole: ["owner", "admin"],
    route: "/teams",
    description: "Workspaces organize your teams, member directories, and project portfolios.",
    actionLabel: "Go to Teams",
  },
  {
    id: "create_project",
    title: "Launch First Project",
    category: "projects",
    targetRole: ["owner", "admin", "member"],
    route: "/projects",
    description: "Create your project board with custom workflows, task priorities, and tags.",
    actionLabel: "Explore Projects",
  },
  {
    id: "manage_tasks",
    title: "Manage Tasks & Board",
    category: "tasks",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/projects",
    description: "Drag-and-drop tasks, toggle checklists, set due dates, and track blockers.",
    actionLabel: "View Board",
  },
  {
    id: "collaborate_documents",
    title: "Real-time Docs & Wiki",
    category: "docs",
    targetRole: ["owner", "admin", "member", "guest"],
    route: "/documents",
    description: "Write specs, sprint notes, and knowledge base pages with live multiplayer collaboration.",
    actionLabel: "Open Documents",
  },
  {
    id: "view_analytics",
    title: "Metrics & Reports",
    category: "analytics",
    targetRole: ["owner", "admin", "member"],
    route: "/analytics",
    description: "Inspect velocity, cycle time, burndown charts, and export custom reports in CSV/PDF.",
    actionLabel: "View Analytics",
  },
];

export const OnboardingProvider = ({ children }) => {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);

  const [state, setState] = useState({
    completed: false,
    dismissed: false,
    step: 0,
    completedSteps: [],
    completedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTourStep, setActiveTourStep] = useState(null); // null = walkthrough closed

  // Fetch or sync onboarding state
  const refreshOnboarding = useCallback(async () => {
    if (!token || !authUser) {
      setLoading(false);
      return;
    }
    try {
      const data = await getOnboardingState();
      setState(data);
    } catch (err) {
      // Fallback to authUser.onboarding if API fails or offline
      if (authUser?.onboarding) {
        setState(authUser.onboarding);
      }
    } finally {
      setLoading(false);
    }
  }, [token, authUser]);

  useEffect(() => {
    refreshOnboarding();
  }, [refreshOnboarding]);

  // Complete a specific milestone step
  const completeStep = useCallback(
    async (stepId) => {
      if (!token) return;
      const nextSteps = Array.from(new Set([...(state.completedSteps || []), stepId]));
      const allDone = ONBOARDING_WORKFLOW_STEPS.every((s) => nextSteps.includes(s.id));

      const updates = {
        completedSteps: nextSteps,
        completed: allDone,
      };

      try {
        const res = await updateOnboardingState(updates);
        setState(res.onboarding);
        if (authUser) {
          dispatch(
            setCredentials({
              user: { ...authUser, onboarding: res.onboarding },
              token,
            })
          );
        }
      } catch (err) {
        console.error("Failed to complete onboarding step:", err);
      }
    },
    [token, state.completedSteps, authUser, dispatch]
  );

  // Dismiss checklist or guided tour
  const dismissOnboarding = useCallback(async () => {
    if (!token) return;
    try {
      const res = await updateOnboardingState({ dismissed: true });
      setState(res.onboarding);
      setActiveTourStep(null);
      if (authUser) {
        dispatch(
          setCredentials({
            user: { ...authUser, onboarding: res.onboarding },
            token,
          })
        );
      }
    } catch (err) {
      console.error("Failed to dismiss onboarding:", err);
    }
  }, [token, authUser, dispatch]);

  // Resume / un-dismiss onboarding
  const resumeOnboarding = useCallback(async () => {
    if (!token) return;
    try {
      const res = await updateOnboardingState({ dismissed: false });
      setState(res.onboarding);
      if (authUser) {
        dispatch(
          setCredentials({
            user: { ...authUser, onboarding: res.onboarding },
            token,
          })
        );
      }
    } catch (err) {
      console.error("Failed to resume onboarding:", err);
    }
  }, [token, authUser, dispatch]);

  // Restart onboarding from scratch
  const restartOnboarding = useCallback(async () => {
    if (!token) return;
    try {
      const res = await resetOnboardingState();
      setState(res.onboarding);
      setActiveTourStep(0);
      if (authUser) {
        dispatch(
          setCredentials({
            user: { ...authUser, onboarding: res.onboarding },
            token,
          })
        );
      }
    } catch (err) {
      console.error("Failed to reset onboarding:", err);
    }
  }, [token, authUser, dispatch]);

  // Start or open walkthrough modal
  const startTour = useCallback((startIndex = 0) => {
    setActiveTourStep(startIndex);
  }, []);

  const closeTour = useCallback(() => {
    setActiveTourStep(null);
  }, []);

  const nextTourStep = useCallback(() => {
    setActiveTourStep((prev) => {
      if (prev === null) return 0;
      if (prev < ONBOARDING_WORKFLOW_STEPS.length - 1) {
        const next = prev + 1;
        completeStep(ONBOARDING_WORKFLOW_STEPS[prev].id);
        return next;
      }
      completeStep(ONBOARDING_WORKFLOW_STEPS[prev].id);
      return null;
    });
  }, [completeStep]);

  const prevTourStep = useCallback(() => {
    setActiveTourStep((prev) => {
      if (prev === null || prev <= 0) return 0;
      return prev - 1;
    });
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        loading,
        steps: ONBOARDING_WORKFLOW_STEPS,
        activeTourStep,
        completeStep,
        dismissOnboarding,
        resumeOnboarding,
        restartOnboarding,
        startTour,
        closeTour,
        nextTourStep,
        prevTourStep,
        refreshOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
