import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Debounce delay in ms before propagating onChange. */
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  debounceMs = 250,
}: SearchInputProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);

  // Keep local in sync if parent resets the value externally.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce propagation so we don't spam the network on every keystroke.
  useEffect(() => {
    if (local === value) return;
    const handle = window.setTimeout(() => onChange(local), debounceMs);
    return () => window.clearTimeout(handle);
  }, [local, value, debounceMs, onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400"
        aria-hidden
      />
      <Input
        type="search"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder ?? t("common.search")}
        className="pl-9"
        aria-label={t("common.search")}
      />
    </div>
  );
}
