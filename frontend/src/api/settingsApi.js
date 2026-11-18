import axiosClient from "./axiosClient";

/**
 * Fetch current user profile
 */
export const getMyProfile = async () => {
  const res = await axiosClient.get("/users/me");
  return res.data;
};

/**
 * Update current user profile fields (name, bio, roleTitle)
 */
export const updateMyProfile = async (profileData) => {
  const res = await axiosClient.put("/users/profile", profileData);
  return res.data;
};

/**
 * Upload new avatar image for user
 */
export const uploadUserAvatar = async (formData) => {
  const res = await axiosClient.post("/users/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/**
 * Change account password
 */
export const changeAccountPassword = async (passwordData) => {
  const res = await axiosClient.put("/users/password", passwordData);
  return res.data;
};

/**
 * Fetch public user profile by ID
 */
export const getUserById = async (userId) => {
  const res = await axiosClient.get(`/users/${userId}`);
  return res.data;
};

/**
 * Fetch all teams/workspaces for current user
 */
export const getMyWorkspaces = async () => {
  const res = await axiosClient.get("/teams/my-teams");
  return res.data;
};

/**
 * Fetch specific team/workspace details
 */
export const getWorkspaceById = async (teamId) => {
  const res = await axiosClient.get(`/teams/${teamId}`);
  return res.data;
};

/**
 * Update workspace settings (name, description)
 */
export const updateWorkspace = async (teamId, workspaceData) => {
  const res = await axiosClient.put(`/teams/${teamId}`, workspaceData);
  return res.data;
};

/**
 * Upload workspace logo
 */
export const uploadWorkspaceLogo = async (teamId, formData) => {
  const res = await axiosClient.post(`/teams/${teamId}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/**
 * Add member to workspace
 */
export const addWorkspaceMember = async (teamId, email) => {
  const res = await axiosClient.post("/teams/add-member", { teamId, email });
  return res.data;
};

/**
 * Remove member from workspace
 */
export const removeWorkspaceMember = async (teamId, memberId) => {
  const res = await axiosClient.delete(`/teams/${teamId}/members/${memberId}`);
  return res.data;
};
