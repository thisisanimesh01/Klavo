import axiosClient from "./axiosClient";

export const getNotifications = async () => {
  const res = await axiosClient.get("/notifications");
  return res.data;
};

export const markNotificationAsRead = async (id) => {
  const res = await axiosClient.put(`/notifications/${id}`);
  return res.data;
};

export const markAllNotificationsAsRead = async () => {
  const res = await axiosClient.put("/notifications/read-all");
  return res.data;
};

export const deleteNotification = async (id) => {
  const res = await axiosClient.delete(`/notifications/${id}`);
  return res.data;
};

export const clearNotifications = async () => {
  const res = await axiosClient.delete("/notifications/clear");
  return res.data;
};

export const getNotificationPreferences = async () => {
  const res = await axiosClient.get("/notifications/preferences");
  return res.data;
};

export const updateNotificationPreferences = async (preferences) => {
  const res = await axiosClient.put("/notifications/preferences", preferences);
  return res.data;
};
