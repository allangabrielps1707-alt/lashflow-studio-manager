import { cn } from "@/lib/utils";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src="/icon-512.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl border border-primary/20" />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-lg font-medium tracking-wide">
            Lash <span className="text-gold">Studio</span>
          </div>
          <div className="eyebrow mt-1 !text-[0.55rem]">Gestão profissional</div>
        </div>
      )}
    </div>
  );
}
