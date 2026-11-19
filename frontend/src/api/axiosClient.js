import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

const axiosClient = axios.create({
  baseURL,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("klavo_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 Unauthorized globally for expired/revoked sessions
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Check if this was a request to login or register (which expect 401 on invalid credentials)
      const url = error.config?.url || "";
      const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

      if (!isAuthEndpoint) {
        // Expired or invalid session: clean storage and redirect to login
        localStorage.removeItem("klavo_access_token");
        localStorage.removeItem("klavo_user");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
