import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from '../../utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'brand' | 'accent';
  onClick?: () => void;
}

const colorClasses: Record<StatCardProps['color'], { icon: string; value: string }> = {
  brand:  { icon: 'bg-brand-100 text-brand-600',   value: 'text-brand-700' },
  indigo: { icon: 'bg-brand-100 text-brand-600',   value: 'text-brand-700' },
  accent: { icon: 'bg-accent-100 text-accent-600', value: 'text-accent-700' },
  green:  { icon: 'bg-accent-100 text-accent-600', value: 'text-accent-700' },
  blue:   { icon: 'bg-brand-100 text-brand-500',   value: 'text-brand-600' },
  yellow: { icon: 'bg-amber-100 text-amber-600',   value: 'text-amber-700' },
  red:    { icon: 'bg-red-100 text-red-600',        value: 'text-red-700' },
  purple: { icon: 'bg-brand-100 text-brand-600',   value: 'text-brand-700' },
};

export function StatCard({ label, value, change, changeLabel, icon, color, onClick }: StatCardProps) {
  const cc = colorClasses[color];
  const up = change !== undefined && change > 0;
  const down = change !== undefined && change < 0;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl border border-gray-100 shadow-card p-5 flex flex-col gap-3 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', cc.icon)}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}</div>
        {change !== undefined && (
          <div className={clsx(
            'flex items-center gap-1 mt-1 text-xs font-semibold',
            up ? 'text-accent-600' : down ? 'text-red-500' : 'text-gray-400',
          )}>
            {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : <Minus size={12} />}
            <span>{Math.abs(change)}% {changeLabel ?? 'vs last month'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
