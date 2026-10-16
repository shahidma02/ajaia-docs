import { FileText } from "lucide-react";

export default function Logo({ heading = false }: { heading?: boolean }) {
  const Name = heading ? "h1" : "span";
  return (
    <span className="brand">
      <span className="logo-mark"><FileText size={heading ? 20 : 18} /></span>
      <Name className={heading ? undefined : "logo"}>Ajaia Docs</Name>
    </span>
  );
}
