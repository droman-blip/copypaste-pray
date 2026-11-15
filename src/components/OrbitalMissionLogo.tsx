import { useId, type FC } from 'react';

interface OrbitalMissionLogoProps {
  /** Custom sizing classes for the SVG emblem */
  className?: string;
  /** Render the crisp ORBITAL MISSION wordmark lockup beside/below the emblem */
  withWordmark?: boolean;
  /** Horizontal (HUD/header) or vertical (Lobby hero) layout when withWordmark is true */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Bespoke aerospace mission crest & orbital trajectory emblem for Orbital Mission.
 */
export const OrbitalMissionLogo: FC<OrbitalMissionLogoProps> = ({
  className = 'w-14 h-14',
  withWordmark = false,
  orientation = 'horizontal',
}) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `om-bg-${uid}`;
  const ringId = `om-ring-${uid}`;
  const orbitId = `om-orbit-${uid}`;
  const planetId = `om-planet-${uid}`;
  const plumeId = `om-plume-${uid}`;

  const emblem = (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Orbital Mission Logo"
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#132547" />
          <stop offset="65%" stopColor="#091124" />
          <stop offset="100%" stopColor="#040711" />
        </radialGradient>
        <linearGradient id={ringId} x1="14" y1="14" x2="106" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={orbitId} x1="18" y1="88" x2="104" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </linearGradient>
        <radialGradient id={planetId} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>
        <linearGradient id={plumeId} x1="40" y1="78" x2="72" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
          <stop offset="50%" stopColor="#F97316" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FEF08A" />
        </linearGradient>
      </defs>

      {/* Outer Precision Bezel */}
      <circle cx="60" cy="60" r="54" fill={`url(#${bgId})`} stroke={`url(#${ringId})`} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="47.5" stroke="#38BDF8" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 4" />

      {/* Cardinal Calibration Ticks */}
      <line x1="60" y1="6" x2="60" y2="12" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="108" x2="60" y2="114" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="60" x2="12" y2="60" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
      <line x1="108" y1="60" x2="114" y2="60" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />

      {/* Crisp Starfield Points */}
      <circle cx="31" cy="34" r="1.5" fill="#E0F2FE" fillOpacity="0.9" />
      <circle cx="88" cy="84" r="1.4" fill="#7DD3FC" fillOpacity="0.85" />
      <circle cx="40" cy="88" r="1.1" fill="#FDE68A" fillOpacity="0.75" />

      {/* Rear Orbital Trajectory Arc */}
      <path
        d="M22 76C18 62 32 42 56 32C76 23 96 26 101 38"
        stroke={`url(#${orbitId})`}
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />

      {/* Central Planetary Globe */}
      <circle cx="58" cy="64" r="22" fill={`url(#${planetId})`} stroke="#7DD3FC" strokeOpacity="0.45" strokeWidth="1.2" />
      {/* Atmospheric Horizon Highlight */}
      <path
        d="M40 53C46 44 59 40 70 45"
        stroke="#FBBF24"
        strokeOpacity="0.7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Subtle Latitude Arc on Globe */}
      <path
        d="M38 67C49 72 67 71 78 63"
        stroke="#BAE6FD"
        strokeOpacity="0.28"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Foreground Orbital Sweep Trajectory */}
      <path
        d="M20 79C33 90 61 84 82 65C97 51 104 37 97 29"
        stroke={`url(#${orbitId})`}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Thruster Exhaust Arc */}
      <path
        d="M52 70C61 63 68 55 75 46"
        stroke={`url(#${plumeId})`}
        strokeWidth="4.2"
        strokeLinecap="round"
      />

      {/* Ascending Delta Orbital Craft */}
      <g transform="translate(80 41) rotate(42)">
        {/* Swept Wings */}
        <path d="M0 -13L10 9L3 6L0 10L-3 6L-10 9Z" fill="#E2E8F0" />
        {/* Fuselage */}
        <path d="M0 -15C2.8 -8 3.6 0 3.2 7H-3.2C-3.6 0 -2.8 -8 0 -15Z" fill="#FFFFFF" />
        {/* Cockpit Visor */}
        <ellipse cx="0" cy="-4.5" rx="1.6" ry="3.2" fill="#0EA5E9" />
        {/* Thruster Core */}
        <circle cx="0" cy="8.5" r="2.2" fill="#F59E0B" />
      </g>

      {/* Orbital Node Marker */}
      <circle cx="24" cy="81" r="3" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.2" />
    </svg>
  );

  if (!withWordmark) {
    return emblem;
  }

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-2.5 text-center">
        {emblem}
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono-tabular uppercase tracking-[0.26em] text-sky-400">
            Cooperative Space Operations
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-white uppercase">
            ORBITAL MISSION
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      {emblem}
      <div className="leading-none">
        <div className="font-display text-sm sm:text-base font-bold tracking-wider text-white uppercase whitespace-nowrap">
          ORBITAL MISSION
        </div>
        <div className="text-[9.5px] font-mono-tabular uppercase tracking-[0.2em] text-sky-400 whitespace-nowrap mt-0.5">
          Space Operations
        </div>
      </div>
    </div>
  );
};
