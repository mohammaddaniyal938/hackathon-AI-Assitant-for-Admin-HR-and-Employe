import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./auth";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useMe(enabled = true) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      window.dispatchEvent(new Event("hcm-auth-token-changed"));
      queryClient.setQueryData(authKeys.me, { user: data.user });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password, role, firstName, lastName, employeeCode, department, designation }: { email: string; password: string; role?: "admin" | "hr" | "employee"; firstName?: string; lastName?: string; employeeCode?: string; department?: string; designation?: string }) =>
      authApi.register(email, password, { role, firstName, lastName, employeeCode, department, designation }),
    onSuccess: (data) => {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      window.dispatchEvent(new Event("hcm-auth-token-changed"));
      queryClient.setQueryData(authKeys.me, { user: data.user });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("hcm-auth-token-changed"));
      queryClient.setQueryData(authKeys.me, null);
      queryClient.clear();
    },
    onError: () => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("hcm-auth-token-changed"));
      queryClient.setQueryData(authKeys.me, null);
      queryClient.clear();
    },
  });
}
