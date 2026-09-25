import { Baby, BookOpen, Car, Dumbbell, Frame, Laptop, LayoutGrid, Recycle, Shirt, ShoppingBasket, Smartphone, Sofa, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  electronics: Laptop,
  "frames-wall-art": Frame,
  "phones-tablets": Smartphone,
  fashion: Shirt,
  "home-living": Sofa,
  "beauty-health": Sparkles,
  sports: Dumbbell,
  "sports-outdoors": Dumbbell,
  automotive: Car,
  "kids-toys": Baby,
  groceries: ShoppingBasket,
  "books-stationery": BookOpen,
  "second-hand": Recycle,
};

/** One lucide icon per root category slug, with a neutral grid icon for anything unknown. */
export const categoryIcon = (slug: string): LucideIcon => ICONS[slug] ?? LayoutGrid;
