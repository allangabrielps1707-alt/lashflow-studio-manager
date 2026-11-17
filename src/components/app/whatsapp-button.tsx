import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";

export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  ...props
}: { phone: string | null | undefined; message?: string; label?: string } & Omit<ButtonProps, "onClick">) {
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
      }}
      {...props}
    >
      <MessageCircle />
      {label}
    </Button>
  );
}
