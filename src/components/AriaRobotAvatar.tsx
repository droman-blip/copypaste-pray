import type { FC } from 'react';

/**
 * Stylized futuristic robot face icon rendered inside the Tablet Home Screen's
 * indigo/violet glossy squircle button.
 */
export const AriaSquircleIcon: FC<{ className?: string }> = ({ className = 'w-11 h-11' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Antenna */}
    <line x1="32" y1="7" x2="32" y2="15" stroke="#E0E7FF" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="32" cy="6.5" r="3.2" fill="#22D3EE" />
    {/* Ear nodes */}
    <rect x="7" y="27" width="5.5" height="14" rx="2.75" fill="#C7D2FE" />
    <rect x="51.5" y="27" width="5.5" height="14" rx="2.75" fill="#C7D2FE" />
    {/* Metallic head shell */}
    <rect
      x="13"
      y="15"
      width="38"
      height="36"
      rx="13"
      fill="#F8FAFC"
      stroke="#E0E7FF"
      strokeWidth="1.5"
    />
    {/* Dark digital visor */}
    <rect x="18" y="23" width="28" height="17" rx="7.5" fill="#090D1A" />
    {/* Glowing cyan/violet digital eyes */}
    <rect x="23" y="28.5" width="6.5" height="6.5" rx="3.25" fill="#22D3EE" />
    <rect x="34.5" y="28.5" width="6.5" height="6.5" rx="3.25" fill="#22D3EE" />
    <circle cx="25.2" cy="30.7" r="1.3" fill="#ECFEFF" />
    <circle cx="36.7" cy="30.7" r="1.3" fill="#ECFEFF" />
    {/* Subtle smile / audio bar */}
    <path
      d="M26 44.5C28.2 46.2 35.8 46.2 38 44.5"
      stroke="#4F46E5"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

interface AriaRobotAvatarProps {
  /** Normalized cursor offset [-1..1] for smooth visor eye tracking */
  gazeX?: number;
  gazeY?: number;
  /** Activates the animated audio equalizer wave & brighter visor glow */
  isSpeaking?: boolean;
}

const EQ_BARS = [
  { delay: '0ms', heightClass: 'h-3' },
  { delay: '90ms', heightClass: 'h-5' },
  { delay: '180ms', heightClass: 'h-7' },
  { delay: '60ms', heightClass: 'h-8' },
  { delay: '210ms', heightClass: 'h-7' },
  { delay: '120ms', heightClass: 'h-5' },
  { delay: '40ms', heightClass: 'h-3' },
];

export const AriaRobotAvatar: FC<AriaRobotAvatarProps> = ({
  gazeX = 0,
  gazeY = 0,
  isSpeaking = false,
}) => {
  const clampedX = Math.max(-1, Math.min(1, gazeX));
  const clampedY = Math.max(-1, Math.min(1, gazeY));
  const eyeOffsetX = clampedX * 4.2;
  const eyeOffsetY = clampedY * 2.4;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Subtle radial backlight */}
      <div
        className="pointer-events-none absolute inset-2 rounded-full blur-2xl transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(124,58,237,0.24) 55%, transparent 78%)',
          opacity: isSpeaking ? 0.95 : 0.6,
        }}
      />

      <div className="relative aria-robot-float">
        <svg
          viewBox="0 0 160 152"
          className="w-32 h-30 sm:w-36 sm:h-34 drop-shadow-[0_14px_24px_rgba(30,27,75,0.65)]"
          role="img"
          aria-label="A.R.I.A. Virtual Robot Avatar"
        >
          <defs>
            <linearGradient id="ariaShellGrad" x1="25" y1="26" x2="135" y2="128" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="50%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <linearGradient id="ariaTorsoGrad" x1="44" y1="116" x2="116" y2="150" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#4338CA" />
            </linearGradient>
            <linearGradient id="ariaVisorGrad" x1="36" y1="54" x2="124" y2="98" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#050814" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="ariaEyeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="65%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
          </defs>

          {/* Pulsing Antenna */}
          <line x1="80" y1="16" x2="80" y2="34" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
          <circle
            cx="80"
            cy="14"
            r="10"
            fill="#22D3EE"
            fillOpacity="0.22"
            className="aria-antenna-pulse"
          />
          <circle cx="80" cy="14" r="5" fill="#22D3EE" stroke="#ECFEFF" strokeWidth="1.5" />

          {/* Shoulders / Collar */}
          <path
            d="M44 148C45 129 60 120 80 120C100 120 115 129 116 148Z"
            fill="url(#ariaTorsoGrad)"
            stroke="#818CF8"
            strokeWidth="1.5"
          />
          <rect x="69" y="114" width="22" height="12" rx="5" fill="#334155" />

          {/* Side Ear Pods */}
          <rect x="19" y="61" width="12" height="32" rx="6" fill="#6366F1" stroke="#A5B4FC" strokeWidth="1.5" />
          <rect x="129" y="61" width="12" height="32" rx="6" fill="#6366F1" stroke="#A5B4FC" strokeWidth="1.5" />
          <circle cx="25" cy="77" r="2.6" fill="#22D3EE" />
          <circle cx="135" cy="77" r="2.6" fill="#22D3EE" />

          {/* Head Chassis */}
          <rect
            x="29"
            y="34"
            width="102"
            height="84"
            rx="32"
            fill="url(#ariaShellGrad)"
            stroke="#F8FAFC"
            strokeWidth="1.5"
          />
          {/* Forehead crown accent */}
          <rect x="64" y="40" width="32" height="4.5" rx="2.25" fill="#6366F1" fillOpacity="0.55" />

          {/* Visor Frame */}
          <rect
            x="38"
            y="50"
            width="84"
            height="48"
            rx="20"
            fill="url(#ariaVisorGrad)"
            stroke={isSpeaking ? '#38BDF8' : '#4F46E5'}
            strokeWidth="2.2"
          />

          {/* Visor Ambient Reflection */}
          <path
            d="M48 56C56 53 72 53 84 55"
            stroke="#FFFFFF"
            strokeOpacity="0.16"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Digital Eyes Group (Tracks cursor + blinks naturally) */}
          <g
            style={{
              transform: `translate(${eyeOffsetX.toFixed(2)}px, ${eyeOffsetY.toFixed(2)}px)`,
              transition: 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <g className="aria-eye-blink">
              {/* Left Eye */}
              <rect
                x="53"
                y="64"
                width="16"
                height={isSpeaking ? '18' : '20'}
                rx="8"
                fill="url(#ariaEyeGrad)"
              />
              <circle cx="58.5" cy="69.5" r="2.4" fill="#ECFEFF" fillOpacity="0.92" />

              {/* Right Eye */}
              <rect
                x="91"
                y="64"
                width="16"
                height={isSpeaking ? '18' : '20'}
                rx="8"
                fill="url(#ariaEyeGrad)"
              />
              <circle cx="96.5" cy="69.5" r="2.4" fill="#ECFEFF" fillOpacity="0.92" />
            </g>
          </g>

          {/* Cheek Telemetry Dots (static micro-accents on chassis) */}
          <circle cx="48" cy="105" r="2" fill="#6366F1" fillOpacity="0.7" />
          <circle cx="112" cy="105" r="2" fill="#6366F1" fillOpacity="0.7" />
        </svg>
      </div>

      {/* Audio Equalizer Wave (activates dynamically when responding) */}
      <div
        className="mt-1 px-3 py-1.5 rounded-xl bg-[#070B16]/90 border border-indigo-500/30 flex items-end justify-center gap-1.5 h-10"
        aria-label={isSpeaking ? 'A.R.I.A. voice active' : 'A.R.I.A. standby'}
      >
        {EQ_BARS.map((bar, idx) => (
          <span
            key={idx}
            style={{
              animationDelay: bar.delay,
              animationPlayState: isSpeaking ? 'running' : 'paused',
              transform: isSpeaking ? undefined : 'scaleY(0.24)',
            }}
            className={`w-1.5 rounded-full transition-colors duration-200 ${bar.heightClass} ${
              isSpeaking
                ? 'aria-eq-bar bg-gradient-to-t from-violet-500 via-indigo-400 to-cyan-300'
                : 'bg-indigo-400/45'
            }`}
          />
        ))}
        <span className="ml-1.5 font-mono-tabular text-[10px] tracking-wider uppercase text-indigo-200/85">
          {isSpeaking ? 'Voice Active' : 'Standby'}
        </span>
      </div>
    </div>
  );
};
