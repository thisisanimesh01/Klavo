import axiosClient from "./axiosClient";

export const aiApi = {
  // 1. Natural Language Task Creation
  extractTask: (prompt, projectId) => {
    return axiosClient.post("/ai/extract-task", { prompt, projectId });
  },

  // 2. Task Breakdown & Acceptance Criteria
  suggestBreakdown: (payload) => {
    return axiosClient.post("/ai/suggest-breakdown", payload);
  },

  // 3. Project Progress Summary
  getProjectSummary: (projectId) => {
    return axiosClient.get(`/ai/project-summary/${projectId}`);
  },

  // 4. Project Risks & Blockers
  getProjectRisks: (projectId) => {
    return axiosClient.get(`/ai/project-risks/${projectId}`);
  },

  // 5. Intelligent Task Prioritization
  getPrioritizationRecommendations: (projectId) => {
    return axiosClient.get(`/ai/prioritize/${projectId}`);
  },

  // 6. Context-Aware Project Q&A
  askQuestion: (projectId, query) => {
    return axiosClient.post("/ai/ask", { projectId, query });
  },
};

export default aiApi;
