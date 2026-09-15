import {
  Wrench,
  CalendarClock,
  HardHat,
  Gauge,
  Warehouse,
  ShoppingCart,
  Factory,
  Boxes,
  ShieldCheck,
  Briefcase,
  Server,
  User,
  type LucideIcon,
} from "lucide-react";

/** Map of icon names referenced in data (e.g. persona.icon) to components. */
const ICONS: Record<string, LucideIcon> = {
  Wrench,
  CalendarClock,
  HardHat,
  Gauge,
  Warehouse,
  ShoppingCart,
  Factory,
  Boxes,
  ShieldCheck,
  Briefcase,
  Server,
  User,
};

/** Icon names available for personas (used by the persona form's icon picker). */
export const ICON_NAMES = Object.keys(ICONS);

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICONS[name] ?? User;
  return <Cmp className={className} />;
}
