import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Plus } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";
import { HelpContactDialog } from "@/components/client/HelpContactDialog";
import { NotificationsBell } from "@/components/client/NotificationsBell";

const ClientLayout = () => {
  const [openNewRequest, setOpenNewRequest] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <ClientSidebar onOpenHelp={() => setOpenHelp(true)} />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Área do cliente
              </span>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsBell />
              <Button
                onClick={() => setOpenNewRequest(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo pedido</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>

      <NewRequestDialog open={openNewRequest} onOpenChange={setOpenNewRequest} />
      <HelpContactDialog open={openHelp} onOpenChange={setOpenHelp} />
    </SidebarProvider>
  );
};

export default ClientLayout;
