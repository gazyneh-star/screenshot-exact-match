import logo from "@/assets/elvyn-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function ElvynLogo({ className }: { className?: string }) {
  return <img src={logo.url} alt="Elvyn" className={cn("select-none object-contain", className)} draggable={false} />;
}
