import React, { useState } from "react";
import { Modal, Button, Input } from "./ui";
import { useOnboarding } from "../context/OnboardingContext";
import axiosClient from "../api/axiosClient";
import { Building2, FolderPlus, ArrowRight, Sparkles } from "lucide-react";

export default function FirstLoginWizardModal({ isOpen, onClose, onComplete }) {
  const { completeStep } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(1); // 1 = workspace, 2 = first project
  const [teamName, setTeamName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError("Please provide a workspace name");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await axiosClient.post("/teams", {
        name: teamName.trim(),
        description: "Primary workspace created during onboarding",
      });
      setCreatedTeamId(res.data._id);
      completeStep("create_workspace");
      setCurrentStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError("Please provide a project name");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await axiosClient.post("/projects", {
        name: projectName.trim(),
        teamId: createdTeamId,
        description: "First project created during onboarding",
      });
      completeStep("create_project");
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="md"
      className="max-w-lg"
    >
      <div className="py-2 space-y-4">
        {/* Wizard header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            {currentStep === 1 ? <Building2 size={22} /> : <FolderPlus size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-400">
                Setup Wizard • Step {currentStep} of 2
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-100">
              {currentStep === 1 ? "Create Your First Workspace" : "Launch Your First Project"}
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {currentStep === 1
            ? "Workspaces act as the tenant umbrella for your teams, member directories, and project portfolios."
            : "Projects house your Kanban boards, backlog sprints, task workflows, documents, and analytics."}
        </p>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {currentStep === 1 ? (
          <form onSubmit={handleCreateWorkspace} className="space-y-4 pt-1">
            <Input
              label="Workspace Name"
              placeholder="e.g. Acme Engineering"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              autoFocus
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <Button variant="ghost" size="sm" onClick={onClose} type="button">
                I'll do this later
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={loading || !teamName.trim()}
                className="flex items-center gap-1.5"
              >
                {loading ? "Creating..." : "Continue"} <ArrowRight size={14} />
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateProject} className="space-y-4 pt-1">
            <Input
              label="Project Name"
              placeholder="e.g. Mobile App Redesign"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <Button variant="ghost" size="sm" onClick={onClose} type="button">
                Skip for now
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={loading || !projectName.trim()}
                className="flex items-center gap-1.5"
              >
                {loading ? "Creating..." : "Finish Setup"} <Sparkles size={14} />
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
