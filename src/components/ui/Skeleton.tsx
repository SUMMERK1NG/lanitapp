import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text' }) => {
  const baseClasses = 'bg-slate-700/40 animate-pulse rounded-md';

  const variants = {
    text: 'h-4 w-3/4',
    circular: 'h-10 w-10 rounded-full',
    rectangular: 'h-32 w-full',
    card: 'h-40 w-full rounded-2xl',
  };

  return <div className={`${baseClasses} ${variants[variant]} ${className}`} />;
};
