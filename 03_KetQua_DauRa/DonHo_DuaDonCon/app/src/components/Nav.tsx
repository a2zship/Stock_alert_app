"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export type NavItem = { href: string; label: string; short: string; icon: IconName; count?: number };

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);
/** Chỉ một mục được đánh dấu: mục khớp dài nhất (/phu-huynh/nho-don thắng /phu-huynh). */
const activeHref = (path: string, items: NavItem[]) =>
  items.filter((l) => matches(path, l.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

export function SideNav({ items }: { items: NavItem[] }) {
  const active = activeHref(usePathname(), items);
  return (
    <nav className="sidenav" aria-label="Điều hướng chính">
      {items.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.href === active ? "page" : undefined}>
          <Icon name={l.icon} />
          {l.label}
          {!!l.count && <span className="count" aria-label={`${l.count} mục mới`}>{l.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Thanh dưới cho màn hình nhỏ — tối đa 5 mục. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const active = activeHref(usePathname(), items);
  return (
    <nav className="bottomnav" aria-label="Điều hướng chính">
      {items.slice(0, 5).map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.href === active ? "page" : undefined}>
          <Icon name={l.icon} size={24} />
          {l.short}
          {!!l.count && <span className="count" aria-label={`${l.count} mục mới`}>{l.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
