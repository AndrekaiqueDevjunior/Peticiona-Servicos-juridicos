import { Mail, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useContactInfo } from "@/lib/contactInfo";

interface HelpContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HelpContactDialog = ({
  open,
  onOpenChange,
}: HelpContactDialogProps) => {
  const { email, whatsappDisplay, whatsappRaw } = useContactInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Precisa de ajuda?</DialogTitle>
          <DialogDescription>
            Entre em contato com a equipe da Peticiona pelo canal de sua preferência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            asChild
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
          >
            <a href={`mailto:${email}`}>
              <Mail className="h-5 w-5 text-primary" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-medium text-foreground">
                  E-mail
                </span>
                <span className="text-xs text-muted-foreground">{email}</span>
              </span>
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
          >
            <a
              href={`https://wa.me/${whatsappRaw}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-5 w-5 text-accent" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-medium text-foreground">
                  WhatsApp
                </span>
                <span className="text-xs text-muted-foreground">
                  {whatsappDisplay}
                </span>
              </span>
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
