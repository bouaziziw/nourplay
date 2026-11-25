"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../i18n/navigation";
import { useTransition } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

const LOCALES = [
  { code: "fr", label: "FR", name: "Français", flag: "🇫🇷" },
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "ar", label: "AR", name: "العربية", flag: "🇸🇦" },
  { code: "es", label: "ES", name: "Español", flag: "🇪🇸" },
] as const;

export function LocaleSwitcher({
  compact = false,
  mode = "buttons",
  className = "",
}: {
  compact?: boolean;
  mode?: "buttons" | "select";
  className?: string;
}) {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuth();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    if (token) {
      api.users.updateLocale(token, newLocale).catch(() => {});
    }
    const search = typeof window !== "undefined" ? window.location.search : "";
    const href = search ? `${pathname}${search}` : pathname;
    startTransition(() => {
      router.replace(href, { locale: newLocale as any });
    });
  };

  if (mode === "select") {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <label className="relative flex items-center cursor-pointer group/locale">
          <span className="sr-only">Choisir la langue</span>
          <span className="pointer-events-none absolute start-2.5 text-xs select-none z-10 text-slate-500">
            🌐
          </span>
          <select
            value={currentLocale}
            disabled={isPending}
            onChange={(event) => handleSwitch(event.target.value)}
            aria-label="Choisir la langue"
            className="h-8 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white/80 hover:bg-sky-50 hover:border-[#1c90d8] ps-7 pe-7 text-xs font-bold text-slate-800 shadow-xs transition-all focus:border-[#1c90d8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c90d8]/20 disabled:cursor-wait disabled:opacity-60"
          >
            {LOCALES.map(({ code, name }) => (
              <option
                key={code}
                value={code}
                className="bg-white text-slate-800 font-medium py-1"
              >
                {name}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-slate-400 group-hover/locale:text-[#1c90d8] transition-colors"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.09 1.03l-4.25 4.5a.75.75 0 01-1.09 0l-4.25-4.5a.75.75 0 01.02-1.05z"
              clipRule="evenodd"
            />
          </svg>
        </label>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {LOCALES.map(({ code, label, flag, name }) => (
        <button
          key={code}
          type="button"
          disabled={isPending}
          onClick={() => handleSwitch(code)}
          title={name}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
            currentLocale === code
              ? "bg-sky-50 text-[#1c90d8] border-[#1c90d8] shadow-xs"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
          } disabled:cursor-wait disabled:opacity-60`}
        >
          <span>{flag}</span>
          <span>{compact ? label : name}</span>
        </button>
      ))}
    </div>
  );
}
