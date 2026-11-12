"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
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
}: {
  compact?: boolean;
  mode?: "buttons" | "select";
}) {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuth();

  const handleSwitch = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    if (token) api.users.updateLocale(token, newLocale).catch(() => {});
    // Replace the locale segment at the start of the path
    const newPath = pathname.replace(
      /^\/[a-z]{2}(-[A-Z]{2})?/,
      `/${newLocale}`,
    );
    router.push(newPath);
  };

  if (mode === "select") {
    return (
      <label className="relative inline-flex items-center">
        <span className="sr-only">Choisir la langue</span>
        <select
          value={currentLocale}
          onChange={(event) => handleSwitch(event.target.value)}
          aria-label="Choisir la langue"
          className="h-8 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-1 pl-2.5 pr-8 text-xs font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {LOCALES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-gray-400"
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
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {LOCALES.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => handleSwitch(code)}
          title={flag}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            currentLocale === code
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          }`}
        >
          {compact ? label : `${flag} ${label}`}
        </button>
      ))}
    </div>
  );
}
