interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ size = 'md' }: BrandLogoProps) {
  const iconDimensions =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className={`${iconDimensions} shrink-0`}
      >
        <rect width="64" height="64" rx="14" fill="#151820" />
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="12"
          stroke="#F5F3EC"
          strokeOpacity="0.14"
          strokeWidth="2"
        />
        <path d="M15 18H35L25.5 46H15V18Z" fill="#F5F3EC" />
        <path d="M33 18H49L39.5 46H29L38.5 18Z" fill="#D5FF3F" />
        <circle cx="47.5" cy="43" r="3.8" fill="#FF6B65" />
      </svg>
      <span
        className={`font-display font-bold tracking-tight text-[#F5F3EC] ${textSize}`}
      >
        VidNova <span className="text-[#D5FF3F]">AI</span>
      </span>
    </span>
  );
}
