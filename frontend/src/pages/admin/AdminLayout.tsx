import { Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminNotificationsBell } from "@/components/admin/AdminNotificationsBell";

const AdminLayout = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Painel administrativo · Peticiona
              </span>
            </div>

            <div className="flex items-center gap-2">
              <AdminNotificationsBell />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
