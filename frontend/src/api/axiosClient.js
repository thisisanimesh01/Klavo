import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:5050/api",
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("klavo_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
