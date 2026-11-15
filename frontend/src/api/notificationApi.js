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
