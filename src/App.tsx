import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import ClientLayout from "./pages/client/ClientLayout.tsx";
import Dashboard from "./pages/client/Dashboard.tsx";
import Orders from "./pages/client/Orders.tsx";
import Balance from "./pages/client/Balance.tsx";
import Account from "./pages/client/Account.tsx";
import StaffLayout from "./pages/staff/StaffLayout.tsx";
import StaffProfile from "./pages/staff/Profile.tsx";
import StaffOrders from "./pages/staff/StaffOrders.tsx";
import StaffFinancial from "./pages/staff/Financial.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/area-cliente" element={<ClientLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="pedidos" element={<Orders />} />
              <Route path="saldos" element={<Balance />} />
              <Route path="conta" element={<Account />} />
            </Route>
            <Route path="/area-interna" element={<StaffLayout />}>
              <Route index element={<Navigate to="/area-interna/perfil" replace />} />
              <Route path="perfil" element={<StaffProfile />} />
              <Route path="pedidos" element={<StaffOrders />} />
              <Route path="financeiro" element={<StaffFinancial />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
