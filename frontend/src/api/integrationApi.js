import axiosClient from "./axiosClient";

export const getApiKeys = (workspaceId) =>
  axiosClient.get(`/integrations/api-keys/workspace/${workspaceId}`);

export const createApiKey = (workspaceId, data) =>
  axiosClient.post(`/integrations/api-keys/workspace/${workspaceId}`, data);

export const revokeApiKey = (id) =>
  axiosClient.post(`/integrations/api-keys/${id}/revoke`);

export const getIntegrations = (workspaceId) =>
  axiosClient.get(`/integrations/workspace/${workspaceId}`);

export const configureIntegration = (workspaceId, data) =>
  axiosClient.post(`/integrations/workspace/${workspaceId}`, data);

export const removeIntegration = (id) =>
  axiosClient.delete(`/integrations/${id}`);

export const getWebhookSubscriptions = (workspaceId) =>
  axiosClient.get(`/integrations/webhooks/workspace/${workspaceId}`);

export const createWebhookSubscription = (workspaceId, data) =>
  axiosClient.post(`/integrations/webhooks/workspace/${workspaceId}`, data);

export const deleteWebhookSubscription = (id) =>
  axiosClient.delete(`/integrations/webhooks/${id}`);

export const getWebhookLogs = (subscriptionId) =>
  axiosClient.get(`/integrations/webhooks/${subscriptionId}/logs`);

export const getIntegrationActivities = (projectId) =>
  axiosClient.get(`/integrations/activity/project/${projectId}`);
