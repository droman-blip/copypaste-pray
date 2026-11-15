import { useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Check,
  Compass,
  Copy,
  Flame,
  Globe2,
  LogIn,
  Microscope,
  Moon,
  Play,
  Plus,
  User,
  Wrench,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../data/missionData';
import type { DifficultyId, RoleId } from '../types/mission';
import { OrbitalMissionLogo } from './OrbitalMissionLogo';
import type { LobbyStageMode } from './SpaceViewport3D';
import { soundFx } from '../utils/soundFx';

interface LobbyScreenProps {
  initialName: string;
  initialRole: RoleId;
  initialDifficulty: DifficultyId;
  stageMode: LobbyStageMode;
  onStageModeChange: (mode: LobbyStageMode) => void;
  onRoleChange: (roleId: RoleId) => void;
  onDifficultyChange: (difficultyId: DifficultyId) => void;
  onEnterBase: (
    playerName: string,
    roleId: RoleId,
    difficultyId: DifficultyId,
    soloTestMode: boolean,
    roomCode?: string,
  ) => void;
}

interface LobbyRoleSpec {
  id: RoleId;
  title: string;
  subtitle: string;
  propLabel: string;
  accentHex: string;
  icon: typeof Wrench;
}

const LOBBY_ROLES: LobbyRoleSpec[] = [
  {
    id: 'systems',
    title: 'Mechanic',
    subtitle: 'Propulsion, Structure & Assembly',
    propLabel: 'Thruster Wrench',
    accentHex: '#F97316',
    icon: Wrench,
  },
  {
    id: 'pilot',
    title: 'Engineer',
    subtitle: 'Avionics, Trajectory & Flight Systems',
    propLabel: 'Telemetry Scanner',
    accentHex: '#3B82F6',
    icon: Compass,
  },
  {
    id: 'science',
    title: 'Scientist',
    subtitle: 'Payload, Sensors & Research',
    propLabel: 'Sample Canister',
    accentHex: '#22C55E',
    icon: Microscope,
  },
  {
    id: 'finance',
    title: 'Program Manager',
    subtitle: 'Budget, Resources & Approvals',
    propLabel: 'Encrypted Briefcase',
    accentHex: '#EAB308',
    icon: Briefcase,
  },
];

const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'medium', 'hard'];

const DIFFICULTY_PRESETS: Record<
  DifficultyId,
  {
    stopIndex: number;
    badgeTitle: string;
    shortTag: string;
    paramsLine: string;
    accentHex: string;
    icon: typeof Globe2;
  }
> = {
  easy: {
    stopIndex: 0,
    badgeTitle: 'EASY — Earth Orbit (LEO)',
    shortTag: 'EASY',
    paramsLine: '6,500 kg max | $150M | 40 Sci',
    accentHex: '#22C55E',
    icon: Globe2,
  },
  medium: {
    stopIndex: 1,
    badgeTitle: 'MEDIUM — The Moon',
    shortTag: 'MEDIUM',
    paramsLine: '5,000 kg max | $100M | 75 Sci',
    accentHex: '#38BDF8',
    icon: Moon,
  },
  hard: {
    stopIndex: 2,
    badgeTitle: 'HARD — Mars Expedition',
    shortTag: 'HARD',
    paramsLine: '3,800 kg max | $80M | 100 Sci',
    accentHex: '#F97316',
    icon: Flame,
  },
};

const GLASS_PANEL_STYLE: CSSProperties = {
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

function generateMissionRoomCode(): string {
  const prefixes = ['NAS', 'ORB', 'VAB', 'KSC', 'SOL', 'LUN'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const digits = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}${digits}`;
}

export function LobbyScreen({
  initialName,
  initialRole,
  initialDifficulty,
  stageMode,
  onStageModeChange,
  onRoleChange,
  onDifficultyChange,
  onEnterBase,
}: LobbyScreenProps) {
  const [playerName, setPlayerName] = useState(
    initialName && initialName.trim() ? initialName : 'Commander Vega',
  );
  const [selectedRole, setSelectedRole] = useState<RoleId>(initialRole);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [hostRoomCode, setHostRoomCode] = useState<string>(() => generateMissionRoomCode());
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [formError, setFormError] = useState('');

  const activeDiffPreset = DIFFICULTY_PRESETS[selectedDifficulty];
  const activeDiffCfg = DIFFICULTY_CONFIGS[selectedDifficulty];
  const activeRoleSpec =
    LOBBY_ROLES.find((r) => r.id === selectedRole) ?? LOBBY_ROLES[0];
  const DiffIcon = activeDiffPreset.icon;

  const handleSelectRole = (roleId: RoleId) => {
    soundFx.unlock();
    soundFx.playKeyClick();
    setSelectedRole(roleId);
    onRoleChange(roleId);
  };

  const handleSliderChange = (index: number) => {
    const nextDiff = DIFFICULTY_ORDER[Math.max(0, Math.min(2, index))] ?? 'medium';
    if (nextDiff !== selectedDifficulty) {
      soundFx.unlock();
      soundFx.playKeyClick();
      setSelectedDifficulty(nextDiff);
      onDifficultyChange(nextDiff);
    }
  };

  const handleOpenHost = () => {
    soundFx.unlock();
    soundFx.playKeyClick();
    setHostRoomCode(generateMissionRoomCode());
    setCopiedCode(false);
    setFormError('');
    onStageModeChange('host');
  };

  const handleOpenJoin = () => {
    soundFx.unlock();
    soundFx.playKeyClick();
    setFormError('');
    onStageModeChange('join');
  };

  const handleOpenSinglePlayer = () => {
    soundFx.unlock();
    soundFx.playKeyClick();
    setFormError('');
    onStageModeChange('singleplayer');
  };

  const handleBackToMenu = () => {
    soundFx.unlock();
    soundFx.playKeyClick();
    setFormError('');
    onStageModeChange('menu');
  };

  const handleCopyRoomCode = async () => {
    soundFx.playKeyClick();
    try {
      await navigator.clipboard.writeText(hostRoomCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleStartHostMission = () => {
    soundFx.unlock();
    const callsign = playerName.trim();
    if (!callsign) {
      setFormError('Enter your crew callsign before starting the mission.');
      return;
    }
    setFormError('');
    soundFx.playKeyClick();
    onEnterBase(callsign, selectedRole, selectedDifficulty, false, hostRoomCode);
  };

  const handleConnectJoinRoom = () => {
    soundFx.unlock();
    const callsign = playerName.trim();
    const normalizedCode = joinRoomCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (normalizedCode.length < 6) {
      setFormError('Enter a valid 6-character Mission Room Code (e.g., NAS482).');
      return;
    }
    if (!callsign) {
      setFormError('Enter your crew callsign before connecting.');
      return;
    }
    setFormError('');
    soundFx.playKeyClick();
    onEnterBase(callsign, selectedRole, selectedDifficulty, false, normalizedCode);
  };

  const handlePlaySinglePlayer = () => {
    soundFx.unlock();
    soundFx.playKeyClick();
    const callsign = playerName.trim() || 'Commander Vega';
    onEnterBase(callsign, selectedRole, selectedDifficulty, true);
  };

  // =========================================================================
  // 2. SINGLE PLAYER STAGING SCREEN (Top 4 Roles + Live 3D Center + PLAY)
  // =========================================================================
  if (stageMode === 'singleplayer') {
    return (
      <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
        {/* Top Area: Back Button + 4 Role Selector Cards */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleBackToMenu}
              style={GLASS_PANEL_STYLE}
              className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#070B14]/70 border border-slate-300/20 hover:border-sky-400/60 text-xs font-semibold text-slate-200 hover:text-white shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div
              style={GLASS_PANEL_STYLE}
              className="pointer-events-auto hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#070B14]/65 border border-slate-300/15 text-[11px] font-mono-tabular uppercase tracking-widest text-slate-300"
            >
              <OrbitalMissionLogo className="w-5 h-5 shrink-0" />
              <span className="font-display font-bold text-white tracking-wider">ORBITAL MISSION</span>
              <span className="text-slate-600">·</span>
              <span>SINGLE PLAYER STAGING</span>
              <span className="text-slate-600">·</span>
              <span style={{ color: activeDiffPreset.accentHex }}>
                {activeDiffPreset.badgeTitle}
              </span>
            </div>
          </div>

          {/* TOP BAR — THE 4 ROLES */}
          <div className="pointer-events-auto mx-auto w-full max-w-5xl grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {LOBBY_ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role.id)}
                  style={{
                    ...GLASS_PANEL_STYLE,
                    borderColor: isSelected ? role.accentHex : 'rgba(148, 163, 184, 0.22)',
                    boxShadow: isSelected
                      ? `0 0 26px ${role.accentHex}38, inset 0 1px 0 rgba(255,255,255,0.14)`
                      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  className={`text-left px-3.5 py-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B1222]/80'
                      : 'bg-[#070B14]/65 hover:bg-[#0B1120]/75'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/15"
                      style={{
                        backgroundColor: `${role.accentHex}24`,
                        color: role.accentHex,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-sm text-white truncate">
                        {role.title}
                      </div>
                      <div
                        className="text-[11px] font-medium truncate mt-0.5"
                        style={{ color: isSelected ? role.accentHex : '#94A3B8' }}
                      >
                        {role.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Foreground stays completely open for the live 3D Character Spotlight */}
        <div className="flex-1" />

        {/* BOTTOM — Compact Role + Difficulty Summary + Large Glowing PLAY Button */}
        <div className="flex flex-col items-center gap-3 pb-1">
          <div
            style={GLASS_PANEL_STYLE}
            className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 rounded-full bg-[#070B14]/75 border border-slate-300/20 shadow-xl text-xs"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: activeRoleSpec.accentHex }}
              />
              <span>{activeRoleSpec.title}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono-tabular text-slate-300">
              Gear: <strong className="text-white">{activeRoleSpec.propLabel}</strong>
            </span>
            <span className="text-slate-600">·</span>
            <span
              className="font-mono-tabular font-semibold"
              style={{ color: activeDiffPreset.accentHex }}
            >
              {activeDiffPreset.badgeTitle}
            </span>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="font-mono-tabular text-slate-400 hidden sm:inline">
              {activeDiffPreset.paramsLine}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePlaySinglePlayer}
            style={{
              boxShadow: `0 0 36px ${activeRoleSpec.accentHex}55, 0 12px 32px rgba(0, 0, 0, 0.65)`,
            }}
            className="pointer-events-auto group relative inline-flex items-center justify-center gap-3 px-14 py-4 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display text-xl sm:text-2xl font-bold tracking-widest uppercase transition-all cursor-pointer whitespace-nowrap border border-white/40"
          >
            <Play className="w-6 h-6 fill-slate-950 shrink-0 transition-transform group-hover:scale-110" />
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. MAIN START MENU / HOST STAGING / JOIN MODAL (Centered Glassmorphism)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      {/* Subtle dark atmospheric vignette around edges without hiding the 3D Hangar */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at center, rgba(4,7,15,0.12) 25%, rgba(4,7,15,0.68) 100%)',
        }}
      />

      {stageMode === 'menu' && (
        <div
          style={GLASS_PANEL_STYLE}
          className="pointer-events-auto relative w-full max-w-md rounded-2xl bg-[#070B14]/70 border border-slate-300/20 shadow-[0_24px_80px_rgba(0,0,0,0.78)] p-6 sm:p-7 space-y-6"
        >
          {/* Metallic Corner Highlight Trim */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/45 to-transparent" />

          {/* Title Header & Logo */}
          <div className="flex flex-col items-center gap-2">
            <OrbitalMissionLogo className="w-16 h-16 drop-shadow-[0_8px_24px_rgba(56,189,248,0.28)]" withWordmark orientation="vertical" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-[10.5px] font-mono-tabular uppercase tracking-widest text-sky-300">
              <span>1–4 Players Co-op</span>
              <span className="text-slate-600">·</span>
              <span>6 Phases · 72 Missions</span>
            </div>
          </div>

          {/* 3 Primary Action Controls */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleOpenHost}
              className="w-full px-5 py-3.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 hover:border-sky-300 text-white font-display font-bold text-base tracking-wide flex items-center justify-between transition-all cursor-pointer whitespace-nowrap shadow-lg"
            >
              <span className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-sky-300 shrink-0" />
                <span>New Game</span>
              </span>
              <span className="text-[11px] font-mono-tabular uppercase tracking-widest text-sky-300">
                Host Room · 1–4P
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenJoin}
              className="w-full px-5 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-slate-300/20 hover:border-slate-200/40 text-white font-display font-bold text-base tracking-wide flex items-center justify-between transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-3">
                <LogIn className="w-5 h-5 text-slate-300 shrink-0" />
                <span>Join Room</span>
              </span>
              <span className="text-[11px] font-mono-tabular uppercase tracking-widest text-slate-400">
                Room Code
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenSinglePlayer}
              className="w-full px-5 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-slate-300/20 hover:border-emerald-400/50 text-white font-display font-bold text-base tracking-wide flex items-center justify-between transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="flex items-center gap-3">
                <User className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Single Player</span>
              </span>
              <span className="text-[11px] font-mono-tabular uppercase tracking-widest text-emerald-300">
                3D Staging
              </span>
            </button>
          </div>

          {/* 4th Control: Difficulty Slider Bar (0..2 snap stops) */}
          <div className="pt-4 border-t border-slate-300/15 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="difficulty-slider"
                className="text-xs font-display font-bold uppercase tracking-widest text-slate-200"
              >
                Difficulty
              </label>
              <span
                className="text-[11px] font-mono-tabular font-semibold uppercase tracking-wider"
                style={{ color: activeDiffPreset.accentHex }}
              >
                {activeDiffPreset.shortTag}
              </span>
            </div>

            <div className="px-1">
              <input
                id="difficulty-slider"
                type="range"
                min={0}
                max={2}
                step={1}
                value={activeDiffPreset.stopIndex}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                style={{ accentColor: activeDiffPreset.accentHex }}
                className="w-full h-2 rounded-lg bg-slate-800/90 cursor-pointer"
              />
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-mono-tabular uppercase tracking-wider">
                {DIFFICULTY_ORDER.map((diffId) => {
                  const preset = DIFFICULTY_PRESETS[diffId];
                  const isActive = selectedDifficulty === diffId;
                  return (
                    <button
                      key={diffId}
                      type="button"
                      onClick={() => handleSliderChange(preset.stopIndex)}
                      className={`cursor-pointer transition-colors px-1 ${
                        isActive ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.shortTag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Difficulty Badge & Target Parameters dynamically beneath slider */}
            <div
              className="rounded-xl border bg-[#050811]/70 px-3.5 py-2.5 flex flex-col gap-1 transition-colors"
              style={{ borderColor: `${activeDiffPreset.accentHex}55` }}
            >
              <div className="flex items-center gap-2">
                <DiffIcon
                  className="w-4 h-4 shrink-0"
                  style={{ color: activeDiffPreset.accentHex }}
                />
                <span className="font-display font-bold text-xs sm:text-sm tracking-wide text-white">
                  {activeDiffPreset.badgeTitle}
                </span>
              </div>
              <div className="font-mono-tabular text-xs text-slate-300">
                {activeDiffPreset.paramsLine}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOST MULTIPLAYER STAGING VIEW ("New Game") */}
      {stageMode === 'host' && (
        <div
          style={GLASS_PANEL_STYLE}
          className="pointer-events-auto relative w-full max-w-xl rounded-2xl bg-[#070B14]/75 border border-slate-300/20 shadow-[0_24px_80px_rgba(0,0,0,0.8)] p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-300/15 pb-3.5">
            <button
              type="button"
              onClick={handleBackToMenu}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-wider text-white uppercase">
              Host Mission Session
            </h2>
            <span
              className="text-[11px] font-mono-tabular font-semibold"
              style={{ color: activeDiffPreset.accentHex }}
            >
              {activeDiffCfg.badge}
            </span>
          </div>

          {/* Generated 6-Character Mission Room Code + Callsign */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-xl bg-[#050811]/75 border border-sky-400/35 p-3.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-sky-400">
                  Mission Room Code
                </div>
                <div className="font-mono-tabular text-2xl font-bold tracking-[0.22em] text-white mt-0.5">
                  {hostRoomCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="px-3 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-semibold text-sky-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label
                htmlFor="host-callsign"
                className="block text-[10px] font-mono-tabular uppercase tracking-widest text-slate-300 mb-1.5"
              >
                Crew Callsign
              </label>
              <input
                id="host-callsign"
                type="text"
                maxLength={28}
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Commander Vega"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050811]/80 border border-slate-400/25 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-slate-300">
              Select Mission Role
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LOBBY_ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role.id)}
                    style={{
                      borderColor: isSelected ? role.accentHex : 'rgba(148,163,184,0.2)',
                    }}
                    className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-white/[0.1]'
                        : 'bg-[#050811]/60 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/10"
                      style={{
                        backgroundColor: `${role.accentHex}22`,
                        color: role.accentHex,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-white truncate">
                        {role.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{role.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

          <div className="pt-2 border-t border-slate-300/15 flex items-center justify-between gap-3">
            <div className="text-xs font-mono-tabular text-slate-300 truncate">
              {activeDiffPreset.badgeTitle} · {activeDiffPreset.paramsLine}
            </div>
            <button
              type="button"
              onClick={handleStartHostMission}
              className="px-6 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
            >
              Start Mission
            </button>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL ("Join Room") */}
      {stageMode === 'join' && (
        <div
          style={GLASS_PANEL_STYLE}
          className="pointer-events-auto relative w-full max-w-md rounded-2xl bg-[#070B14]/75 border border-slate-300/20 shadow-[0_24px_80px_rgba(0,0,0,0.8)] p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-300/15 pb-3.5">
            <button
              type="button"
              onClick={handleBackToMenu}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="font-display text-lg font-bold tracking-wider text-white uppercase">
              Join Mission Room
            </h2>
            <span className="w-12" />
          </div>

          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="join-room-code"
                className="block text-[10px] font-mono-tabular uppercase tracking-widest text-sky-400 mb-1.5"
              >
                6-Character Mission Room Code
              </label>
              <input
                id="join-room-code"
                type="text"
                maxLength={6}
                value={joinRoomCode}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  setJoinRoomCode(clean);
                  if (formError) setFormError('');
                }}
                placeholder="NAS482"
                className="w-full px-4 py-3 rounded-xl bg-[#050811]/85 border border-slate-400/25 font-mono-tabular text-xl font-bold tracking-[0.28em] text-center text-white placeholder-slate-600 uppercase focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label
                htmlFor="join-callsign"
                className="block text-[10px] font-mono-tabular uppercase tracking-widest text-slate-300 mb-1.5"
              >
                Crew Callsign
              </label>
              <input
                id="join-callsign"
                type="text"
                maxLength={28}
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Commander Vega"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050811]/85 border border-slate-400/25 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-slate-300 mb-1.5">
                Assign Station Role
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LOBBY_ROLES.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleSelectRole(role.id)}
                      style={{
                        borderColor: isSelected ? role.accentHex : 'rgba(148,163,184,0.2)',
                      }}
                      className={`px-2.5 py-2 rounded-lg border text-left text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white/[0.1] text-white'
                          : 'bg-[#050811]/60 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: role.accentHex }} />
                      <span className="truncate">{role.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

          <div className="pt-2 border-t border-slate-300/15 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToMenu}
              className="px-4 py-2.5 rounded-xl border border-slate-400/25 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleConnectJoinRoom}
              className="px-6 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer whitespace-nowrap shadow-lg"
            >
              Connect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
