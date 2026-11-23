import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";

export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  onSent,
  ...props
}: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  /** Called once WhatsApp was opened, e.g. to tick the reminder off. */
  onSent?: () => void;
} & Omit<ButtonProps, "onClick">) {
  return (
    <Button
      type="button"
      variant="whatsapp"
      onClick={(e) => {
        e.stopPropagation();
        const url = whatsappLink(phone, message);
        if (!url) {
          toast.error("Cadastre um telefone válido com DDD para usar o WhatsApp.");
          return;
        }
        window.open(url, "_blank", "noopener");
        onSent?.();
      }}
      {...props}
    >
      <MessageCircle />
      {label}
    </Button>
  );
}
