import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // allow refresh token cookie if used
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("klavo_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default axiosClient;
