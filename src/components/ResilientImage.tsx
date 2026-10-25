import { useState } from 'react';
import { Film } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  fallbackLabel?: string;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  priority = false,
  fallbackLabel,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#151820] text-[#9298A6] p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Film className="w-8 h-8 text-[#D5FF3F] mb-3 opacity-80" />
        <span className="text-xs font-medium text-[#F5F3EC]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
