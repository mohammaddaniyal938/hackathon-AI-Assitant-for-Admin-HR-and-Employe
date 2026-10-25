import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const clearStoredSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event("hcm-auth-token-changed"));
};

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = typeof window === "undefined" ? null : localStorage.getItem("accessToken");
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || "");
    const isAuthRequest = /\/auth\/(login|register|refresh)$/.test(requestUrl);

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      const refreshToken = typeof window === "undefined" ? null : localStorage.getItem("refreshToken");
      if (!refreshToken) {
        clearStoredSession();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        localStorage.setItem("accessToken", data.accessToken);
        originalRequest.headers.set("Authorization", `Bearer ${data.accessToken}`);
        return api(originalRequest);
      } catch {
        clearStoredSession();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
