"use client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

function ToastHost() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-right" theme={resolvedTheme === "dark" ? "dark" : "light"} richColors closeButton duration={4000} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = (mutation.meta as { successMessage?: string } | undefined)?.successMessage ?? "Changes saved successfully.";
        toast.success(message);
      },
      onError: (error, _variables, _context, mutation) => {
        const fallback = error instanceof Error ? error.message : "Unable to save changes. Please try again.";
        const message = (mutation.meta as { errorMessage?: string } | undefined)?.errorMessage ?? fallback;
        toast.error(message);
      },
    }),
  }));
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  const publicPath = pathname === "/login" || pathname === "/register" || pathname.startsWith("/api/auth");
  useEffect(() => { if (!publicPath && !session.isPending && !session.data?.user) router.replace("/login"); }, [publicPath, router, session.data?.user, session.isPending]);
  const authenticated = !publicPath && Boolean(session.data?.user);
  return <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="medicore-theme" disableTransitionOnChange><QueryClientProvider client={queryClient}><ToastHost />{authenticated ? <DashboardSidebar>{children}</DashboardSidebar> : children}</QueryClientProvider></ThemeProvider>;
}
