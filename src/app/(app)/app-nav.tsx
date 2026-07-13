"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";

/**
 * Barra de navegación de la app autenticada. Es cliente para resaltar la sección activa según
 * la ruta (`usePathname`). Los iconos son SVG en línea (stroke = currentColor) para no depender
 * de librerías externas ni romper la CSP. El estado de admin y el email llegan como props desde
 * el layout, que es quien verifica la sesión en el servidor.
 */

type IconProps = { className?: string };

function IconPen({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconImage({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLayers({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <path d="m12 3 9 5-9 5-9-5 9-5Z" strokeLinejoin="round" />
      <path d="m3 13 9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}
function IconUser({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/generate", label: "Generar", Icon: IconPen },
  { href: "/images", label: "Imágenes", Icon: IconImage },
  { href: "/articles", label: "Historial", Icon: IconClock },
  { href: "/batches", label: "Lotes", Icon: IconLayers },
  { href: "/account", label: "Cuenta", Icon: IconUser },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-primary flex size-7 items-center justify-center rounded-lg text-sm font-bold text-white">
        P
      </span>
      <span className="text-base font-semibold">PostIA</span>
    </span>
  );
}

export function AppNav({ userEmail, isAdmin }: { userEmail: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin", Icon: IconSettings }]
    : NAV_ITEMS;

  // Una sección está activa si la ruta coincide o es descendiente (p. ej. /articles/123).
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-muted/15 bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link href="/generate" aria-label="PostIA — inicio" className="mr-2 shrink-0">
            <Logo />
          </Link>
          {items.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-muted hidden sm:inline">{userEmail}</span>
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
