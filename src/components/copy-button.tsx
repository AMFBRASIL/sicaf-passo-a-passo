import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "icon";
};

export function CopyButton({ value, label, className, size = "icon" }: Props) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button
      type="button"
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      className={cn(
        size === "icon" ? "h-6 w-6" : "h-7 gap-1.5 px-2 text-xs",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void copy(value, label);
      }}
      aria-label={label ? `Copiar ${label}` : "Copiar"}
      title={label ? `Copiar ${label}` : "Copiar"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      {size !== "icon" && (copied ? "Copiado" : "Copiar")}
    </Button>
  );
}
