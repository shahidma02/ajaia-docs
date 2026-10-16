import { LoaderCircle } from "lucide-react";

export default function Spinner({ size = 28, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <LoaderCircle size={size} />
    </span>
  );
}
