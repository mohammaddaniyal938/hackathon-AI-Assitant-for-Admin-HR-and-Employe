"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import FloatingChatButton from "@/components/assistant/FloatingChatButton";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    } else if (!loading && user?.isTempPassword && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [user, loading, pathname, router]);

  if (loading || !user || (user.isTempPassword && pathname !== "/change-password")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {children}
      {pathname !== "/change-password" && !user.isTempPassword && <FloatingChatButton />}
    </>
  );
}
