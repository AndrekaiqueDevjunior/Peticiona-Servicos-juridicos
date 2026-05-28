import { useState, Component, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Plus } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";
import { HelpContactDialog } from "@/components/client/HelpContactDialog";
import { NotificationsBell } from "@/components/client/NotificationsBell";

class ClientErrorBoundary extends Component<{ children: ReactNode }, { error: string | null; stack: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message, stack: error.stack ?? null };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", background: "#fff0f0", minHeight: "100vh" }}>
          <h2 style={{ color: "#c00" }}>Erro na área do cliente</h2>
          <p style={{ color: "#c00", marginBottom: 8 }}>{this.state.error}</p>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "#333", background: "#fee", padding: 16, borderRadius: 6 }}>
            {this.state.stack}
          </pre>
          <button onClick={() => { this.setState({ error: null, stack: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: "8px 16px", background: "#c00", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const ClientLayoutWithBoundary = () => (
  <ClientErrorBoundary>
    <ClientLayout />
  </ClientErrorBoundary>
);

export default ClientLayoutWithBoundary;
