import React from 'react';
import * as LucideIcons from 'lucide-react';
import {
  UtensilsCrossed,
  ShoppingCart,
  Car,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  ShoppingBag,
  MoreHorizontal,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  BadgeDollarSign,
  Wallet,
  CreditCard,
  PiggyBank,
  Banknote,
  DollarSign,
  Clock,
  Wifi,
  Receipt,
  Sparkles,
  Layers,
  Smartphone,
  Zap,
  Fuel,
  Plane,
  Coffee,
  BookOpen,
  Stethoscope,
  Music,
  Dumbbell,
  ArrowUpRight,
  ArrowDownLeft,
  type LucideProps
} from 'lucide-react';

const iconMap: Record<string, React.FC<LucideProps>> = {
  UtensilsCrossed,
  ShoppingCart,
  Car,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  ShoppingBag,
  MoreHorizontal,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  BadgeDollarSign,
  Wallet,
  CreditCard,
  PiggyBank,
  Banknote,
  DollarSign,
  Clock,
  Wifi,
  Receipt,
  Sparkles,
  Layers,
  Smartphone,
  Zap,
  Fuel,
  Plane,
  Coffee,
  BookOpen,
  Stethoscope,
  Music,
  Dumbbell,
  ArrowUpRight,
  ArrowDownLeft,
};

interface CategoryIconProps {
  iconName?: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName = 'DollarSign',
  className = 'w-5 h-5',
  size = 20,
  style,
}) => {
  const IconComponent =
    iconMap[iconName] ||
    (LucideIcons as Record<string, any>)[iconName] ||
    (LucideIcons as Record<string, any>)[iconName?.toLowerCase()] ||
    DollarSign;
  return <IconComponent className={className} size={size} style={style} />;
};

