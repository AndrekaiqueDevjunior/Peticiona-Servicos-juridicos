import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRole, setRole, dashboardPathForRole, type UserRole } from "@/lib/roles";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Signup from "./pages/Signup.tsx";
import ClientLayout from "./pages/client/ClientLayout.tsx";
import Dashboard from "./pages/client/Dashboard.tsx";
import Orders from "./pages/client/Orders.tsx";
import Balance from "./pages/client/Balance.tsx";
import Account from "./pages/client/Account.tsx";
import StaffLayout from "./pages/staff/StaffLayout.tsx";
import StaffProfile from "./pages/staff/Profile.tsx";
import StaffOrders from "./pages/staff/StaffOrders.tsx";
import StaffFinancial from "./pages/staff/Financial.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminProfile from "./pages/admin/AdminProfile.tsx";
import AdminOrders from "./pages/admin/AdminOrders.tsx";
import AdminClients from "./pages/admin/AdminClients.tsx";
import AdminStaff from "./pages/admin/AdminStaff.tsx";
import AdminFinancial from "./pages/admin/AdminFinancial.tsx";
import AdminPlans from "./pages/admin/AdminPlans.tsx";
import PaymentTest from "./pages/admin/PaymentTest.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RoleRoute({
  allow,
  children,
}: {
  allow: UserRole;
  children: React.ReactNode;
}) {
  const role = useRole();
  const [params] = useSearchParams();
  const as = params.get("as") as UserRole | null;

  // Atalho dev: ?as=admin|funcionario|cliente troca o role no localStorage.
  useEffect(() => {
    if (as && (as === "admin" || as === "funcionario" || as === "cliente") && as !== role) {
      setRole(as);
    }
  }, [as, role]);

  const efetivo = as ?? role;
  if (efetivo !== allow) return <Navigate to={dashboardPathForRole(efetivo)} replace />;
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
            <Route path="/cadastro" element={<Signup />} />
            <Route path="/area-cliente" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="pedidos" element={<Orders />} />
              <Route path="saldos" element={<Balance />} />
              <Route path="conta" element={<Account />} />
            </Route>
            <Route path="/area-interna" element={<ProtectedRoute><StaffLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/area-interna/perfil" replace />} />
              <Route path="perfil" element={<StaffProfile />} />
              <Route path="pedidos" element={<StaffOrders />} />
              <Route path="financeiro" element={<StaffFinancial />} />
            </Route>
            <Route
              path="/admin"
              element={
                <RoleRoute allow="admin">
                  <AdminLayout />
                </RoleRoute>
              }
            >
              <Route index element={<Navigate to="/admin/perfil" replace />} />
              <Route path="perfil" element={<AdminProfile />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="clientes" element={<AdminClients />} />
              <Route path="funcionarios" element={<AdminStaff />} />
              <Route path="financeiro" element={<AdminFinancial />} />
              <Route path="planos" element={<AdminPlans />} />
              <Route path="teste-pagamento" element={<PaymentTest />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
