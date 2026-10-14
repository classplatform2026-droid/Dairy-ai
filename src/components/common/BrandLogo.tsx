import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = false,
}) => {
  const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Reference leaf / folded feather black mark */}
      <div className={`${iconSize} rounded-md bg-black text-white flex items-center justify-center shrink-0 shadow-xs`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className={`${textSize} font-bold tracking-tight text-neutral-900 leading-none`}>
          LifeNote AI
        </span>
        {showTagline && (
          <span className="text-[11px] text-neutral-500 tracking-normal mt-0.5">
            Your thoughts. Your life.
          </span>
        )}
      </div>
    </div>
  );
};
