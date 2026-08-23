import React from 'react';
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
  DollarSign
};

interface CategoryIconProps {
  iconName?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName = 'DollarSign',
  className = 'w-5 h-5',
  size = 20
}) => {
  const IconComponent = iconMap[iconName] || DollarSign;
  return <IconComponent className={className} size={size} />;
};
