import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Eye,
  Flame,
  FlaskConical,
  Lock,
  LogOut,
  Map as MapIcon,
  Orbit,
  RotateCcw,
  Rocket,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  InteractableModal,
  type WhiteboardNote,
} from './components/InteractableModal';
import { LobbyScreen } from './components/LobbyScreen';
import { MinigameWorkbenchModal } from './components/MinigameWorkbenchModal';
import { OrbitalMissionLogo } from './components/OrbitalMissionLogo';
import { SpaceViewport3D, type LobbyStageMode } from './components/SpaceViewport3D';
import { TabletHud } from './components/TabletHud';
import { BudgetAllocationDeskModal } from './components/labs/BudgetAllocationDeskModal';
import {
  OrbitalWhiteboardModal,
  computeOrbitalMetrics,
} from './components/labs/OrbitalWhiteboardModal';
import { ThermalMaterialLabModal } from './components/labs/ThermalMaterialLabModal';
import {
  MINIGAMES_72,
  MINIGAME_MAP,
  PHASE_6_MAP,
  getMinigamesForPhase,
  getMinigamesForRoleAndPhase,
} from './data/minigamesData';
import {
  CARGO_MAP,
  CARGO_MODULES,
  DIFFICULTY_CONFIGS,
  INITIAL_DEPT_MESSAGES,
  INTERACTABLES_MAP,
  ROLES,
  ROLE_MAP,
  ROOM_MAP,
  canAccessRoom,
} from './data/missionData';
import type {
  ActiveConflict,
  BudgetAllocationSummary,
  CargoModuleState,
  DepartmentMessage,
  DifficultyId,
  InteractableId,
  LaunchOutcome,
  MinigameInstanceState,
  MinigamePayload,
  MinigameValidationResult,
  MissionLogEntry,
  MissionPhaseNumber,
  OrbitalTrajectoryConfig,
  RoleId,
  RoomId,
  ThermalReportSummary,
} from './types/mission';
import {
  computeSharedMissionState,
  createInitialMinigameStates,
  evaluateLaunchOutcome6,
  getMissionResourcesFromSharedState,
  getUnlocked3DModulesFromMinigames,
} from './utils/minigameEngine';
import { soundFx } from './utils/soundFx';

interface ToastBanner {
  id: number;
  tone: 'info' | 'success' | 'warning' | 'locked';
  text: string;
}

const INITIAL_WHITEBOARD_NOTES: Record<string, WhiteboardNote[]> = {
  'sys-whiteboard': [
    {
      id: 'wb-sys-1',
      text: 'Verify total mass <= Annex C limit and keep CoG within ±18 mm',
      checked: false,
    },
    {
      id: 'wb-sys-2',
      text: 'Pass modal test M33* and 3D assembly M41 before Gate G43',
      checked: false,
    },
  ],
  'fin-whiteboard': [
    {
      id: 'wb-fin-1',
      text: 'Preserve UFE contingency reserve >= 12% at G11 and G41',
      checked: false,
    },
    {
      id: 'wb-fin-2',
      text: 'Coordinate 4-role votes at Gates G13, G23, G43, and G53',
      checked: false,
    },
  ],
  'sci-whiteboard': [
    {
      id: 'wb-sci-1',
      text: 'Reach target science return while keeping power demand within margin',
      checked: false,
    },
    {
      id: 'wb-sci-2',
      text: 'Validate orbital coverage C23/A11 >= 70% and spectral calibration C31/C52',
      checked: false,
    },
  ],
  'plt-whiteboard': [
    {
      id: 'wb-plt-1',
      text: 'Ensure net power margin >= +25 W and >= 4h eclipse autonomy',
      checked: false,
    },
    {
      id: 'wb-plt-2',
      text: 'Verify Δv in I42 and Ka/S DSN comms network in I43/I51',
      checked: false,
    },
  ],
};

function formatNow(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createInitialCargoStates(): Record<string, CargoModuleState> {
  const map: Record<string, CargoModuleState> = {};
  for (const def of CARGO_MODULES) {
    map[def.id] = {
      id: def.id,
      integrity: 100,
      delivered: false,
      riskPenaltyPct: 0,
    };
  }
  return map;
}

export default function App() {
  const [inLobby, setInLobby] = useState(true);
  const [lobbyStageMode, setLobbyStageMode] = useState<LobbyStageMode>('menu');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [briefingActive, setBriefingActive] = useState(false);
  const [playerName, setPlayerName] = useState('Commander Vega');
  const [activeRole, setActiveRole] = useState<RoleId>('systems');
  const [difficulty, setDifficulty] = useState<DifficultyId>('medium');
  const [soloTestMode, setSoloTestMode] = useState(false);
  const [activeRoom, setActiveRoom] = useState<RoomId>('overview');

  const [currentPhase, setCurrentPhase] = useState<MissionPhaseNumber>(1);
  const [minigameStates, setMinigameStates] = useState<Record<string, MinigameInstanceState>>(
    createInitialMinigameStates,
  );
  const [activeMinigameCode, setActiveMinigameCode] = useState<string | null>(null);

  const [emergencyAlert, setEmergencyAlert] = useState(false);
  const [pendingLaunchOutcome, setPendingLaunchOutcome] = useState<LaunchOutcome | null>(null);
  const [launchOutcome, setLaunchOutcome] = useState<LaunchOutcome | null>(null);

  const [departmentMessages, setDepartmentMessages] = useState<DepartmentMessage[]>(
    INITIAL_DEPT_MESSAGES,
  );
  const [whiteboardNotes, setWhiteboardNotes] = useState<Record<string, WhiteboardNote[]>>(
    INITIAL_WHITEBOARD_NOTES,
  );
  const [activeInteractable, setActiveInteractable] = useState<InteractableId | null>(null);
  const [explodedView, setExplodedView] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [tabletOpen, setTabletOpen] = useState(false);
  const tabletOpenRef = useRef(tabletOpen);
  tabletOpenRef.current = tabletOpen;
  const [cargoStates, setCargoStates] = useState<Record<string, CargoModuleState>>(
    createInitialCargoStates,
  );
  const [orbitalTrajectory, setOrbitalTrajectory] = useState<OrbitalTrajectoryConfig>(() =>
    computeOrbitalMetrics('moon', 140, 680, 88.0, 'medium', false),
  );
  const [hologramProjectorActive, setHologramProjectorActive] = useState(false);
  const [thermalReport, setThermalReport] = useState<ThermalReportSummary | null>(null);
  const [budgetAllocation, setBudgetAllocation] = useState<BudgetAllocationSummary | null>(null);
  const [activeCustomLab, setActiveCustomLab] = useState<
    'orbital-wb' | 'thermal-lab' | 'budget-desk' | null
  >(null);
  const [meetingCinematicActive, setMeetingCinematicActive] = useState(false);
  const [facilityMapOpen, setFacilityMapOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [toast, setToast] = useState<ToastBanner | null>(null);
  const [, setLogs] = useState<MissionLogEntry[]>([
    {
      id: 'init-1',
      timestamp: '00:00:00',
      playerName: 'Base Control',
      roleId: 'pilot',
      action: 'join',
      message: 'Space complex operational. 6 phases and 72 missions ready on station.',
    },
  ]);

  useEffect(() => {
    const unlock = () => {
      soundFx.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (emergencyAlert && !inLobby && !briefingActive && !isLaunching) {
      soundFx.startRedAlertKlaxon();
    } else {
      soundFx.stopRedAlertKlaxon();
    }
    return () => {
      soundFx.stopRedAlertKlaxon();
    };
  }, [briefingActive, emergencyAlert, inLobby, isLaunching]);

  const handleSetTabletOpen = useCallback((nextOpen: boolean) => {
    if (tabletOpenRef.current === nextOpen) return;
    tabletOpenRef.current = nextOpen;
    soundFx.unlock();
    if (nextOpen) {
      soundFx.playTabletDraw();
    } else {
      soundFx.playTabletHolster();
    }
    setTabletOpen(nextOpen);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (inLobby || briefingActive || isLaunching || meetingCinematicActive) return;
      if (
        activeInteractable ||
        activeMinigameCode ||
        activeCustomLab ||
        hologramProjectorActive ||
        launchOutcome
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!e.repeat) {
          handleSetTabletOpen(!tabletOpen);
        }
      } else if (e.key === 'Escape' && tabletOpen) {
        e.preventDefault();
        handleSetTabletOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeInteractable,
    activeMinigameCode,
    activeCustomLab,
    briefingActive,
    handleSetTabletOpen,
    hologramProjectorActive,
    inLobby,
    isLaunching,
    launchOutcome,
    meetingCinematicActive,
    tabletOpen,
  ]);

  const sharedState = useMemo(
    () => computeSharedMissionState(minigameStates, difficulty, cargoStates),
    [cargoStates, difficulty, minigameStates],
  );

  const installedModuleIds = useMemo(
    () => getUnlocked3DModulesFromMinigames(minigameStates),
    [minigameStates],
  );

  const resources = useMemo(
    () => getMissionResourcesFromSharedState(sharedState),
    [sharedState],
  );

  const activeConflicts = useMemo<ActiveConflict[]>(() => {
    return sharedState.recalcRequiredCodes.map((code) => {
      const def = MINIGAME_MAP[code];
      const depRole = def?.dependsOnCodes[0]
        ? MINIGAME_MAP[def.dependsOnCodes[0]]?.roleId ?? 'systems'
        : 'finance';
      return {
        id: `recalc-${code}`,
        code,
        phaseNumber: def?.phaseNumber ?? 1,
        sourceRole: def?.roleId ?? 'systems',
        title: `Recalculation pending in ${code} (${def?.title ?? code})`,
        affectedRoles: [def?.roleId ?? 'systems', depRole],
        severity: 'warning',
        description: `An upstream mission that ${code} depends on was updated. Reopen ${code} and reconfirm it.`,
        resolved: false,
      };
    });
  }, [sharedState.recalcRequiredCodes]);

  const showToast = useCallback(
    (tone: ToastBanner['tone'], text: string) => {
      const id = Date.now();
      setToast({ id, tone, text });
      window.setTimeout(() => {
        setToast((prev) => (prev && prev.id === id ? null : prev));
      }, 4000);
    },
    [],
  );

  const appendLog = useCallback(
    (
      name: string,
      roleId: RoleId,
      action: MissionLogEntry['action'],
      message: string,
    ) => {
      setLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: formatNow(),
          playerName: name,
          roleId,
          action,
          message,
        },
        ...prev,
      ]);
    },
    [],
  );

  const handleEnterBase = (
    name: string,
    roleId: RoleId,
    selectedDiff: DifficultyId,
    soloMode: boolean,
    missionRoomCode?: string,
  ) => {
    setPlayerName(name);
    setActiveRole(roleId);
    setDifficulty(selectedDiff);
    setSoloTestMode(soloMode);
    setRoomCode(missionRoomCode ?? null);
    setInLobby(false);
    setLobbyStageMode('menu');
    setActiveRoom(ROLE_MAP[roleId].roomId);
    setBriefingActive(true);
    setActiveInteractable(null);
    setActiveMinigameCode(null);
    setTabletOpen(false);
    setExplodedView(false);
    setIsLaunching(false);
    setPendingLaunchOutcome(null);
    setLaunchOutcome(null);
    setEmergencyAlert(false);
    setMeetingCinematicActive(false);
    setHologramProjectorActive(false);
    setActiveCustomLab(null);
    setFacilityMapOpen(false);
    setThermalReport(null);
    setBudgetAllocation(null);
    const defaultBody = DIFFICULTY_CONFIGS[selectedDiff].targetBody;
    setOrbitalTrajectory(
      computeOrbitalMetrics(
        defaultBody,
        defaultBody === 'earth' ? 412 : defaultBody === 'mars' ? 280 : 140,
        defaultBody === 'earth' ? 580 : defaultBody === 'mars' ? 1450 : 680,
        defaultBody === 'earth' ? 51.6 : defaultBody === 'mars' ? 74.2 : 88.0,
        selectedDiff,
        false,
      ),
    );
    setCurrentPhase(1);
    setMinigameStates(createInitialMinigameStates());
    setCargoStates(createInitialCargoStates());

    const roleName = ROLE_MAP[roleId].name;
    const diffCfg = DIFFICULTY_CONFIGS[selectedDiff];
    setLogs([
      {
        id: `join-${Date.now()}`,
        timestamp: formatNow(),
        playerName: name,
        roleId,
        action: 'join',
        message: `Checked in ${name} as ${roleName} for ${diffCfg.label} (${diffCfg.targetName})${
          missionRoomCode ? ` · Room ${missionRoomCode}` : ''
        }${soloMode ? ' · Solo Test Mode' : ''}.`,
      },
    ]);
  };

  const handleCompleteBriefing = useCallback(() => {
    setBriefingActive(false);
    const roleDef = ROLE_MAP[activeRole];
    setActiveRoom(roleDef.roomId);
    showToast(
      'info',
      `Inside ${roleDef.roomName}. Open your Workstation or Tablet to start Phase 1 (72 missions).`,
    );
  }, [activeRole, showToast]);

  const handleSelectRoom = useCallback(
    (roomId: RoomId) => {
      if (!canAccessRoom(roomId, activeRole)) {
        const roomDef = ROOM_MAP[roomId];
        const ownerDef = roomDef.ownerRole ? ROLE_MAP[roomDef.ownerRole] : null;
        showToast(
          'locked',
          `Access restricted to ${roomDef.name}. Reserved for ${
            ownerDef ? ownerDef.name : 'assigned specialist'
          }.`,
        );
        return;
      }
      setActiveRoom(roomId);
      setActiveInteractable(null);
      setHologramProjectorActive(false);
      setFacilityMapOpen(false);
    },
    [activeRole, showToast],
  );

  const handleOpenMapOverview = useCallback(() => {
    setActiveRoom('overview');
    setActiveInteractable(null);
    setHologramProjectorActive(false);
    setFacilityMapOpen(false);
  }, []);

  const handleSwitchRole = useCallback(
    (newRole: RoleId) => {
      setActiveRole(newRole);
      setActiveInteractable(null);
      const roleDef = ROLE_MAP[newRole];
      if (ROOM_MAP[activeRoom].type === 'private') {
        setActiveRoom(roleDef.roomId);
      }
      showToast('info', `Active role switched to ${roleDef.name}`);
    },
    [activeRoom, showToast],
  );

  const handleSelectInteractable = useCallback((id: InteractableId) => {
    setTabletOpen(false);
    const interactable = INTERACTABLES_MAP[id];
    if (interactable.kind === 'drawer') {
      soundFx.playDrawerSlide(true);
      soundFx.playPaperRustle();
    } else if (interactable.kind === 'computer' || interactable.kind === 'comms') {
      soundFx.playKeyClick();
    }
    setActiveInteractable(id);
  }, []);

  const handleOpenMinigame = useCallback((code: string) => {
    if (!MINIGAME_MAP[code]) return;
    soundFx.playKeyClick();
    setActiveMinigameCode(code);
  }, []);

  const handleSaveDraft = useCallback(
    (code: string, nextPayload: MinigamePayload, undoStack: MinigamePayload[]) => {
      setMinigameStates((prev) => {
        const cur = prev[code];
        if (!cur) return prev;
        return {
          ...prev,
          [code]: {
            ...cur,
            status: cur.status === 'no_iniciado' ? 'en_progreso' : cur.status,
            draftPayload: nextPayload,
            undoStack,
            updatedAt: formatNow(),
          },
        };
      });
      showToast('info', `Draft saved for ${code}.`);
    },
    [showToast],
  );

  const handleSimulateMinigame = useCallback(
    (
      code: string,
      nextPayload: MinigamePayload,
      undoStack: MinigamePayload[],
      validation: MinigameValidationResult,
    ) => {
      setMinigameStates((prev) => {
        const cur = prev[code];
        if (!cur) return prev;
        return {
          ...prev,
          [code]: {
            ...cur,
            status: validation.passed ? 'validado' : 'en_progreso',
            draftPayload: nextPayload,
            undoStack,
            lastValidation: validation,
            updatedAt: formatNow(),
          },
        };
      });
      showToast(
        validation.passed ? 'success' : 'warning',
        validation.passed
          ? `${code}: simulation passed. You can click "Confirm Decision".`
          : `${code}: active blockers detected in the Validation panel.`,
      );
    },
    [showToast],
  );

  const handleRequestReview = useCallback(
    (
      code: string,
      nextPayload: MinigamePayload,
      undoStack: MinigamePayload[],
      validation: MinigameValidationResult,
    ) => {
      setMinigameStates((prev) => {
        const cur = prev[code];
        if (!cur) return prev;
        return {
          ...prev,
          [code]: {
            ...cur,
            status: 'pendiente_revision',
            draftPayload: nextPayload,
            undoStack,
            lastValidation: validation,
            updatedAt: formatNow(),
          },
        };
      });
      appendLog(playerName, activeRole, 'comms', `Requested team review for ${code}.`);
      showToast('info', `${code} sent for cooperative review.`);
    },
    [activeRole, appendLog, playerName, showToast],
  );

  const handleConfirmMinigame = useCallback(
    (
      code: string,
      nextPayload: MinigamePayload,
      justification: string,
      validation: MinigameValidationResult,
    ) => {
      const def = MINIGAME_MAP[code];
      if (!def || !validation.passed) return;

      const nowTime = formatNow();
      let invalidatedDownstream: string[] = [];
      let nextPhaseUnlocked: MissionPhaseNumber | null = null;

      setMinigameStates((prev) => {
        const cur = prev[code];
        if (!cur) return prev;

        const nextVersion = cur.history.length + 1;
        const entry = {
          id: `ver-${code}-${nextVersion}-${Date.now()}`,
          version: nextVersion,
          timestamp: nowTime,
          authorName: playerName,
          authorRole: activeRole,
          summary: `${def.title} (v${nextVersion})`,
          justification,
          snapshotPayload: JSON.parse(JSON.stringify(nextPayload)) as MinigamePayload,
        };

        const updated: Record<string, MinigameInstanceState> = {
          ...prev,
          [code]: {
            ...cur,
            status: 'confirmado',
            dirtyNeedsRecalc: false,
            draftPayload: JSON.parse(JSON.stringify(nextPayload)) as MinigamePayload,
            confirmedPayload: JSON.parse(JSON.stringify(nextPayload)) as MinigamePayload,
            lastValidation: validation,
            history: [entry, ...cur.history],
            updatedAt: nowTime,
          },
        };

        // Mark downstream confirmed minigames that depend on `code` as needing recalculation
        const queue = [code];
        const visited = new Set<string>([code]);
        const dirtyList: string[] = [];

        while (queue.length > 0) {
          const sourceCode = queue.shift()!;
          for (const candidate of MINIGAMES_72) {
            if (visited.has(candidate.code)) continue;
            if (candidate.dependsOnCodes.includes(sourceCode)) {
              const candState = updated[candidate.code];
              if (candState && candState.status === 'confirmado') {
                updated[candidate.code] = {
                  ...candState,
                  status: 'requiere_cambios',
                  dirtyNeedsRecalc: true,
                  updatedAt: nowTime,
                };
                dirtyList.push(candidate.code);
                visited.add(candidate.code);
                queue.push(candidate.code);
              }
            }
          }
        }
        invalidatedDownstream = dirtyList;

        // Check phase advancement
        if (currentPhase < 6) {
          const phaseMeta = PHASE_6_MAP[currentPhase];
          const phaseGames = getMinigamesForPhase(currentPhase);
          const doneCount = phaseGames.filter(
            (m) => updated[m.code]?.status === 'confirmado',
          ).length;
          const gateOk =
            !phaseMeta.gateCode || updated[phaseMeta.gateCode]?.status === 'confirmado';
          if (doneCount >= 10 && gateOk) {
            nextPhaseUnlocked = (currentPhase + 1) as MissionPhaseNumber;
          }
        }

        return updated;
      });

      appendLog(
        playerName,
        activeRole,
        'mission',
        `Confirmed ${code} (${def.title}): ${justification}`,
      );

      if (invalidatedDownstream.length > 0) {
        showToast(
          'warning',
          `${code} confirmed. Recalculation required in: ${invalidatedDownstream.join(', ')}`,
        );
      } else if (nextPhaseUnlocked) {
        setCurrentPhase(nextPhaseUnlocked);
        showToast(
          'success',
          `${code} confirmed. Phase ${currentPhase} cleared — Advancing to Phase ${nextPhaseUnlocked}/6.`,
        );
      } else {
        showToast('success', `${code} (${def.title}) confirmed in Shared State.`);
      }
    },
    [activeRole, appendLog, currentPhase, playerName, showToast],
  );

  const handleRevertVersion = useCallback(
    (code: string, historyEntryId: string) => {
      setMinigameStates((prev) => {
        const cur = prev[code];
        const target = cur?.history.find((h) => h.id === historyEntryId);
        if (!cur || !target) return prev;
        return {
          ...prev,
          [code]: {
            ...cur,
            status: 'en_progreso',
            draftPayload: JSON.parse(JSON.stringify(target.snapshotPayload)) as MinigamePayload,
            updatedAt: formatNow(),
          },
        };
      });
      showToast('info', `${code} reverted to draft. Review and reconfirm.`);
    },
    [showToast],
  );

  const handleAddComment = useCallback(
    (code: string, text: string) => {
      setMinigameStates((prev) => {
        const cur = prev[code];
        if (!cur) return prev;
        return {
          ...prev,
          [code]: {
            ...cur,
            comments: [
              {
                id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                timestamp: formatNow(),
                authorName: `${playerName} (${ROLE_MAP[activeRole].shortName})`,
                authorRole: activeRole,
                text,
              },
              ...cur.comments,
            ],
          },
        };
      });
    },
    [activeRole, playerName],
  );

  const handleAdvancePhase = useCallback(
    (targetPhase?: MissionPhaseNumber) => {
      const next = targetPhase ?? ((currentPhase < 6 ? currentPhase + 1 : 6) as MissionPhaseNumber);
      setCurrentPhase(next);
      showToast('info', `Active phase switched to ${PHASE_6_MAP[next].code}: ${PHASE_6_MAP[next].title}`);
    },
    [currentPhase, showToast],
  );

  const handleCallEmergencyMeeting = useCallback(() => {
    setEmergencyAlert(true);
    setActiveRoom('meeting');
    setActiveInteractable(null);
    setActiveMinigameCode(null);
    setActiveCustomLab(null);
    setHologramProjectorActive(false);
    setTabletOpen(false);
    setFacilityMapOpen(false);
    setMeetingCinematicActive(true);
    appendLog(
      playerName,
      activeRole,
      'alert',
      'Urgent Crew Meeting initiated — Specialists entering Gates Room via Airlock.',
    );
    showToast('warning', 'Urgent Crew Meeting initiated in the Gates Room!');
  }, [activeRole, appendLog, playerName, showToast]);

  const handleCompleteMeetingCinematic = useCallback(() => {
    setMeetingCinematicActive(false);
    setActiveRoom('meeting');
    setActiveInteractable('mtg-holo');
    showToast('info', 'Crew assembled around Holographic Table — Review Gates & Annex C.');
  }, [showToast]);

  const handleCancelRedAlert = useCallback(() => {
    setEmergencyAlert(false);
    soundFx.stopRedAlertKlaxon();
    showToast('info', 'Red Alert deactivated.');
  }, [showToast]);

  const markMissionCodesConfirmed = useCallback(
    (codes: string[], justification: string) => {
      const nowTime = formatNow();
      setMinigameStates((prev) => {
        const next = { ...prev };
        for (const c of codes) {
          const cur = next[c];
          if (cur && cur.status !== 'confirmado') {
            next[c] = {
              ...cur,
              status: 'confirmado',
              confirmedPayload: { ...cur.draftPayload },
              dirtyNeedsRecalc: false,
              updatedAt: nowTime,
              history: [
                {
                  id: `hist-lab-${Date.now()}-${c}`,
                  version: cur.history.length + 1,
                  timestamp: nowTime,
                  authorName: `${playerName} (${ROLE_MAP[activeRole].shortName})`,
                  authorRole: activeRole,
                  summary: justification,
                  justification,
                  snapshotPayload: { ...cur.draftPayload },
                },
                ...cur.history,
              ],
            };
          }
        }
        return next;
      });
    },
    [activeRole, playerName],
  );

  const handleProjectHologram = useCallback(
    (config: OrbitalTrajectoryConfig) => {
      setOrbitalTrajectory(config);
      setActiveCustomLab(null);
      setActiveInteractable(null);
      setActiveRoom('pilot');
      setHologramProjectorActive(true);
      soundFx.playHoloProject();
      showToast('info', '3D Holographic Trajectory projected inside Engineer Lab.');
    },
    [showToast],
  );

  const handleValidateHologramMission = useCallback(() => {
    const confirmedConfig: OrbitalTrajectoryConfig = {
      ...orbitalTrajectory,
      validated: true,
    };
    setOrbitalTrajectory(confirmedConfig);
    setHologramProjectorActive(false);
    markMissionCodesConfirmed(
      ['I13', 'I23'],
      `3D Holographic Trajectory validated (${confirmedConfig.perigeeKm}–${confirmedConfig.apogeeKm} km, ${confirmedConfig.inclinationDeg}°).`,
    );
    appendLog(
      playerName,
      activeRole,
      'mission',
      `Validated ${confirmedConfig.targetBody.toUpperCase()} orbital trajectory (${confirmedConfig.perigeeKm}–${confirmedConfig.apogeeKm} km).`,
    );
    soundFx.playDeliveryChime();
    showToast('success', 'Trajectory validated & synced to Mission Tablet!');
  }, [activeRole, appendLog, markMissionCodesConfirmed, orbitalTrajectory, playerName, showToast]);

  const handleSubmitThermalReport = useCallback(
    (summary: ThermalReportSummary) => {
      setThermalReport(summary);
      setActiveCustomLab(null);
      markMissionCodesConfirmed(
        ['M21', 'C22'],
        `Thermal stress report certified with ${summary.selectedShieldMaterial} (requirement >= ${summary.requirementC}°C).`,
      );
      appendLog(
        playerName,
        activeRole,
        'mission',
        `Thermal Lab report delivered to Engineer: ${summary.selectedShieldMaterial} certified.`,
      );
      soundFx.playDeliveryChime();
      showToast('success', 'Thermal Report submitted to Engineer & synced to Tablet!');
    },
    [activeRole, appendLog, markMissionCodesConfirmed, playerName, showToast],
  );

  const handleApproveBudgetDesk = useCallback(
    (summary: BudgetAllocationSummary) => {
      setBudgetAllocation(summary);
      setActiveCustomLab(null);
      markMissionCodesConfirmed(
        ['G11', 'G31'],
        `Approved & signed treasury allocation of $${summary.totalAllocatedM.toFixed(1)}M across 4 departments.`,
      );
      appendLog(
        playerName,
        activeRole,
        'mission',
        `Budget Allocation Desk signed: $${summary.totalAllocatedM.toFixed(1)}M disbursed.`,
      );
      soundFx.playDeliveryChime();
      showToast('success', 'Budget approved & signed across all 4 departments!');
    },
    [activeRole, appendLog, markMissionCodesConfirmed, playerName, showToast],
  );

  const handleSendMessage = useCallback(
    (toRole: RoleId | 'all', text: string) => {
      const msg: DepartmentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromRole: activeRole,
        toRole,
        senderName: `${playerName} (${ROLE_MAP[activeRole].shortName})`,
        text,
        timestamp: formatNow(),
      };
      setDepartmentMessages((prev) => [msg, ...prev]);
      showToast('success', 'Message transmitted to the complex network.');
    },
    [activeRole, playerName, showToast],
  );

  const handleAddWhiteboardNote = useCallback((boardId: InteractableId, text: string) => {
    setWhiteboardNotes((prev) => ({
      ...prev,
      [boardId]: [
        ...(prev[boardId] ?? []),
        { id: `note-${Date.now()}`, text, checked: false },
      ],
    }));
  }, []);

  const handleToggleWhiteboardNote = useCallback((boardId: InteractableId, noteId: string) => {
    setWhiteboardNotes((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).map((n) =>
        n.id === noteId ? { ...n, checked: !n.checked } : n,
      ),
    }));
  }, []);

  const handleTriggerLaunch = useCallback(() => {
    const outcomeSnapshot = evaluateLaunchOutcome6(
      difficulty,
      sharedState,
      minigameStates,
      currentPhase,
      activeConflicts,
    );

    setPendingLaunchOutcome(outcomeSnapshot);
    setLaunchOutcome(null);
    setExplodedView(false);
    setActiveInteractable(null);
    setActiveMinigameCode(null);
    setTabletOpen(false);
    setActiveRoom('hangar');
    setIsLaunching(true);

    appendLog(
      playerName,
      activeRole,
      'launch',
      `Launch simulation started in ${PHASE_6_MAP[currentPhase].code} (${DIFFICULTY_CONFIGS[difficulty].targetName}).`,
    );
  }, [
    activeConflicts,
    activeRole,
    appendLog,
    currentPhase,
    difficulty,
    minigameStates,
    playerName,
    sharedState,
  ]);

  const finalizeLaunchCinematic = useCallback(
    (skipped: boolean) => {
      setIsLaunching(false);
      if (pendingLaunchOutcome) {
        setLaunchOutcome(pendingLaunchOutcome);
        appendLog(
          'Flight Director',
          'pilot',
          'launch',
          pendingLaunchOutcome.success
            ? `Mission complete${skipped ? ' (telemetry fast-forwarded)' : ''}: ${pendingLaunchOutcome.destinationName}`
            : `Simulation aborted in Phase ${pendingLaunchOutcome.currentPhase}/6: ${pendingLaunchOutcome.rootCauseHeadline}`,
        );
        setPendingLaunchOutcome(null);
      }
    },
    [appendLog, pendingLaunchOutcome],
  );

  const handleCompleteLaunchCinematic = useCallback(() => {
    finalizeLaunchCinematic(false);
  }, [finalizeLaunchCinematic]);

  const handleSkipLaunchCinematic = useCallback(() => {
    finalizeLaunchCinematic(true);
  }, [finalizeLaunchCinematic]);

  const handleResetLaunch = useCallback(() => {
    setIsLaunching(false);
    setPendingLaunchOutcome(null);
    setLaunchOutcome(null);
    showToast('info', 'Vehicle reset on the Hangar launch pad.');
  }, [showToast]);

  const handleExitFocus = useCallback(() => {
    if (activeInteractable && INTERACTABLES_MAP[activeInteractable]?.kind === 'drawer') {
      soundFx.playDrawerSlide(false);
    }
    setActiveInteractable(null);
  }, [activeInteractable]);

  const handleCargoDamaged = useCallback(
    (cargoId: string, nextIntegrity: number, riskAddedPct: number) => {
      setCargoStates((prev) => {
        const current = prev[cargoId] ?? {
          id: cargoId,
          integrity: 100,
          delivered: false,
          riskPenaltyPct: 0,
        };
        return {
          ...prev,
          [cargoId]: {
            ...current,
            integrity: Math.max(0, Math.min(100, nextIntegrity)),
            riskPenaltyPct: current.riskPenaltyPct + riskAddedPct,
          },
        };
      });

      if (riskAddedPct > 0) {
        const def = CARGO_MAP[cargoId];
        showToast(
          'warning',
          `${def?.shortLabel ?? 'Cargo'} damaged (${nextIntegrity}% integrity, +${riskAddedPct}% risk).`,
        );
      }
    },
    [showToast],
  );

  const handleCargoDelivered = useCallback(
    (cargoId: string) => {
      const def = CARGO_MAP[cargoId];
      setCargoStates((prev) => {
        const current = prev[cargoId];
        if (!current || current.delivered) return prev;
        return {
          ...prev,
          [cargoId]: {
            ...current,
            delivered: true,
          },
        };
      });
      showToast('success', `${def?.name ?? 'Module'} docked on the Hangar Platform.`);
    },
    [showToast],
  );

  const myPhaseMinigames = getMinigamesForRoleAndPhase(activeRole, currentPhase);
  const myNextPending =
    myPhaseMinigames.find((m) => minigameStates[m.code]?.status !== 'confirmado') ??
    myPhaseMinigames[0];
  const recalcCount = sharedState.recalcRequiredCodes.length;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060911]">
      {/* 3D Interactive Space Complex Viewport */}
      <SpaceViewport3D
        inLobby={inLobby}
        lobbyStageMode={lobbyStageMode}
        briefingActive={briefingActive}
        activeRoom={activeRoom}
        activeRole={activeRole}
        difficulty={difficulty}
        currentPhase={currentPhase}
        emergencyAlert={emergencyAlert}
        installedModuleIds={installedModuleIds}
        cargoStates={cargoStates}
        explodedView={explodedView}
        isLaunching={isLaunching}
        launchMode={pendingLaunchOutcome?.failureMode ?? null}
        focusedInteractable={activeInteractable}
        tabletOpen={tabletOpen}
        hologramProjectorConfig={orbitalTrajectory}
        hologramProjectorActive={hologramProjectorActive}
        meetingCinematicActive={meetingCinematicActive}
        onSelectRoom={handleSelectRoom}
        onSelectInteractable={handleSelectInteractable}
        onExitFocus={handleExitFocus}
        onCompleteBriefing={handleCompleteBriefing}
        onCompleteLaunchCinematic={handleCompleteLaunchCinematic}
        onSkipLaunchCinematic={handleSkipLaunchCinematic}
        onCargoDamaged={handleCargoDamaged}
        onCargoDelivered={handleCargoDelivered}
        onCancelRedAlert={handleCancelRedAlert}
        onValidateHologramMission={handleValidateHologramMission}
        onEditHologramWhiteboard={() => {
          setHologramProjectorActive(false);
          setActiveCustomLab('orbital-wb');
        }}
        onCloseHologramProjector={() => setHologramProjectorActive(false)}
        onCompleteMeetingCinematic={handleCompleteMeetingCinematic}
      />

      {/* Lobby Overlay */}
      {inLobby && (
        <LobbyScreen
          initialName={playerName}
          initialRole={activeRole}
          initialDifficulty={difficulty}
          stageMode={lobbyStageMode}
          onStageModeChange={setLobbyStageMode}
          onRoleChange={setActiveRole}
          onDifficultyChange={setDifficulty}
          onEnterBase={handleEnterBase}
        />
      )}

      {/* Active Mission Floating HUD */}
      {!inLobby && !briefingActive && !isLaunching && (
        <>
          {/* Top-Left Status & Quick Minigame Launcher */}
          <div className="fixed top-3.5 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100vw-24rem)]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-700/90 shadow-lg text-xs">
              <OrbitalMissionLogo className="w-4 h-4 shrink-0" />
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: ROLE_MAP[activeRole].colorHex }}
              />
              <span className="font-semibold text-white truncate max-w-[140px]">
                {playerName}
              </span>
              {roomCode && (
                <>
                  <span className="text-slate-600 hidden lg:inline">·</span>
                  <span className="font-mono-tabular text-[11px] text-sky-400 hidden lg:inline">
                    {roomCode}
                  </span>
                </>
              )}
              <span className="text-slate-600">·</span>
              <span
                className="font-display font-bold whitespace-nowrap"
                style={{ color: ROLE_MAP[activeRole].colorHex }}
              >
                {ROLE_MAP[activeRole].shortName}
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="text-sky-300 font-mono-tabular font-semibold hidden sm:inline whitespace-nowrap">
                Phase {currentPhase}/6
              </span>
              <span className="text-slate-600 hidden md:inline">·</span>
              <span className="text-slate-300 hidden md:inline whitespace-nowrap">
                {ROOM_MAP[activeRoom].shortLabel}
              </span>
            </div>

            {myNextPending && !activeInteractable && !activeMinigameCode && (
              <button
                type="button"
                onClick={() => handleOpenMinigame(myNextPending.code)}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>
                  {myNextPending.code}: {myNextPending.title}
                </span>
              </button>
            )}

            {soloTestMode && !activeInteractable && !activeMinigameCode && (
              <div className="flex items-center gap-1 bg-[#0B101B]/95 border border-slate-700/80 rounded-lg p-1 shadow-lg">
                {ROLES.map((r) => {
                  const selected = r.id === activeRole;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSwitchRole(r.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-slate-800 text-white border border-slate-500'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-xs shrink-0"
                        style={{ backgroundColor: r.colorHex }}
                      />
                      <span>{r.shortName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top-Right Compact Controls */}
          <div className="fixed top-3.5 right-4 z-20 flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFacilityMapOpen((v) => !v)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeRoom === 'overview' || facilityMapOpen
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-[#0B101B]/95 border-slate-700 hover:border-sky-400 text-white'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>3D Map / Facility Map</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {facilityMapOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0A101E] border border-slate-700 shadow-2xl p-2 z-50 space-y-1.5">
                  <div className="px-2 py-1 text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                    Facility Navigation
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenMapOverview}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 text-xs font-semibold text-sky-300 flex items-center justify-between cursor-pointer"
                  >
                    <span>Aerial 3D Facility Overview</span>
                    <MapIcon className="w-3.5 h-3.5" />
                  </button>
                  {(
                    [
                      { id: 'hangar', label: 'Rocket Hangar (VAB)', dot: '#38BDF8' },
                      { id: 'systems', label: 'Systems Lab (Mechanic)', dot: '#F97316' },
                      { id: 'pilot', label: 'Orbital & Avionics Lab (Engineer)', dot: '#3B82F6' },
                      { id: 'science', label: 'Material & Payload Lab (Scientist)', dot: '#22C55E' },
                      { id: 'finance', label: 'Finance & Contracts Office', dot: '#EAB308' },
                      { id: 'meeting', label: 'Gates Room (Holographic Table)', dot: '#06B6D4' },
                    ] as Array<{ id: RoomId; label: string; dot: string }>
                  ).map((rm) => {
                    const locked = !soloTestMode && !canAccessRoom(rm.id, activeRole);
                    return (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() => {
                          if (soloTestMode) {
                            setActiveRoom(rm.id);
                            setActiveInteractable(null);
                            setHologramProjectorActive(false);
                            setFacilityMapOpen(false);
                          } else {
                            handleSelectRoom(rm.id);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                          activeRoom === rm.id
                            ? 'bg-sky-500/15 text-white font-semibold border border-sky-500/40'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: rm.dot }}
                          />
                          <span className="truncate">{rm.label}</span>
                        </span>
                        {locked && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                      </button>
                    );
                  })}

                  <div className="pt-1.5 mt-1 border-t border-slate-800 space-y-1">
                    <div className="px-2 py-0.5 text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                      Interactive Lab Benches
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityMapOpen(false);
                        setActiveCustomLab('orbital-wb');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-950/60 text-xs text-cyan-200 flex items-center gap-2 cursor-pointer"
                    >
                      <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Orbital Whiteboard &amp; 3D Holo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityMapOpen(false);
                        setActiveCustomLab('thermal-lab');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-orange-950/60 text-xs text-orange-200 flex items-center gap-2 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>Thermal Stress Lab (Blowtorch)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityMapOpen(false);
                        setActiveCustomLab('budget-desk');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950/60 text-xs text-amber-200 flex items-center gap-2 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>Budget Allocation Desk</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSoloTestMode((prev) => {
                  const next = !prev;
                  showToast(
                    'info',
                    next
                      ? 'Solo Test Mode enabled: switch between all 4 roles and jump across all 6 phases.'
                      : 'Solo Test Mode disabled.',
                  );
                  return next;
                });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer whitespace-nowrap ${
                soloTestMode
                  ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                  : 'bg-[#0B101B]/95 border-slate-700 hover:border-slate-500 text-slate-300'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Solo Test</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.unlock();
                const nextMuted = !soundMuted;
                soundFx.setMuted(nextMuted);
                setSoundMuted(nextMuted);
                if (!nextMuted) soundFx.playKeyClick();
              }}
              title={soundMuted ? 'Unmute audio' : 'Mute audio'}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {soundMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="hidden sm:inline">{soundMuted ? 'Mute' : 'SFX'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLaunching(false);
                setPendingLaunchOutcome(null);
                setLaunchOutcome(null);
                setBriefingActive(false);
                setActiveInteractable(null);
                setActiveMinigameCode(null);
                setTabletOpen(false);
                setLobbyStageMode('menu');
                setInLobby(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lobby</span>
            </button>
          </div>

          {/* Bottom-Left Room Controls */}
          {!activeInteractable && !activeMinigameCode && (
            <div className="fixed bottom-4 left-4 z-20 flex flex-wrap items-center gap-2">
              {activeRoom === 'overview' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectRoom('hangar')}
                    className="px-3 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-700 hover:border-sky-400 text-xs font-semibold text-white shadow-lg cursor-pointer"
                  >
                    Rocket Hangar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRoom('meeting')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold text-white shadow-lg cursor-pointer ${
                      recalcCount > 0 || emergencyAlert
                        ? 'bg-rose-950 border-rose-400 red-alert-strobe'
                        : 'bg-[#0B101B]/95 border-slate-700 hover:border-cyan-400'
                    }`}
                  >
                    Gates Room
                    {recalcCount > 0 ? ` (${recalcCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRoom(ROLE_MAP[activeRole].roomId)}
                    className="px-3 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-700 hover:border-white text-xs font-semibold text-white shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: ROLE_MAP[activeRole].colorHex }}
                    />
                    <span>My Lab</span>
                  </button>
                </>
              ) : (
                <>
                  {activeRoom === 'hangar' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExplodedView((v) => !v)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer ${
                          explodedView
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#0B101B]/95 border-slate-700 hover:border-slate-500 text-slate-200'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{explodedView ? 'Collapse' : 'Exploded View'}</span>
                      </button>

                      {isLaunching ? (
                        <button
                          type="button"
                          onClick={handleResetLaunch}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Pad</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleTriggerLaunch}
                          className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>SIMULATE LAUNCH</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="hidden md:block px-2.5 py-1.5 rounded-lg bg-[#0B101B]/95 border border-slate-800 text-[11px] text-slate-400 shadow">
                    WASD · Walk | Shift · Sprint | Drag · Look | Left Click · Use | Right Click / E · Tractor Beam
                  </div>
                </>
              )}
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div
                className={`px-4 py-2 rounded-lg border text-xs font-medium shadow-xl flex items-center gap-2 whitespace-nowrap ${
                  toast.tone === 'locked'
                    ? 'bg-[#19121A] border-amber-500/50 text-amber-200'
                    : toast.tone === 'warning'
                      ? 'bg-[#1C1414] border-rose-500/50 text-rose-200'
                      : toast.tone === 'success'
                        ? 'bg-[#0C1B18] border-emerald-500/50 text-emerald-200'
                        : 'bg-[#0B1324] border-sky-500/50 text-sky-100'
                }`}
              >
                {toast.tone === 'locked' && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {toast.tone === 'warning' && (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                {toast.tone === 'success' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>{toast.text}</span>
              </div>
            </div>
          )}

          {/* Station Interaction Modal */}
          {activeInteractable && (
            <InteractableModal
              interactableId={activeInteractable}
              activeRole={activeRole}
              difficulty={difficulty}
              currentPhase={currentPhase}
              installedModuleIds={installedModuleIds}
              sharedState={sharedState}
              minigameStates={minigameStates}
              activeConflicts={activeConflicts}
              emergencyAlert={emergencyAlert}
              resources={resources}
              cargoStates={cargoStates}
              departmentMessages={departmentMessages}
              whiteboardNotes={whiteboardNotes}
              explodedView={explodedView}
              isLaunching={isLaunching}
              onOpenMinigame={handleOpenMinigame}
              onCallEmergencyMeeting={handleCallEmergencyMeeting}
              onCancelRedAlert={handleCancelRedAlert}
              onSendMessage={handleSendMessage}
              onAddWhiteboardNote={handleAddWhiteboardNote}
              onToggleWhiteboardNote={handleToggleWhiteboardNote}
              onToggleExploded={() => setExplodedView((v) => !v)}
              onTriggerLaunch={handleTriggerLaunch}
              onResetLaunch={handleResetLaunch}
              onOpenCustomLab={(lab) => setActiveCustomLab(lab)}
              onClose={handleExitFocus}
            />
          )}

          {/* Bespoke Interactive Labs (Orbital Whiteboard, Thermal Laser Blowtorch, Budget Desk) */}
          {activeCustomLab === 'orbital-wb' && (
            <OrbitalWhiteboardModal
              difficulty={difficulty}
              initialConfig={orbitalTrajectory}
              onProject3DHologram={handleProjectHologram}
              onClose={() => setActiveCustomLab(null)}
            />
          )}

          {activeCustomLab === 'thermal-lab' && (
            <ThermalMaterialLabModal
              difficulty={difficulty}
              initialSummary={thermalReport}
              onSubmitReport={handleSubmitThermalReport}
              onClose={() => setActiveCustomLab(null)}
            />
          )}

          {activeCustomLab === 'budget-desk' && (
            <BudgetAllocationDeskModal
              difficulty={difficulty}
              initialSummary={budgetAllocation}
              onApproveBudget={handleApproveBudgetDesk}
              onClose={() => setActiveCustomLab(null)}
            />
          )}

          {/* 3-Column Reusable Minigame Workbench */}
          {activeMinigameCode && minigameStates[activeMinigameCode] && (
            <MinigameWorkbenchModal
              code={activeMinigameCode}
              instanceState={minigameStates[activeMinigameCode]}
              allStates={minigameStates}
              sharedState={sharedState}
              activeRole={activeRole}
              playerName={playerName}
              difficulty={difficulty}
              onSaveDraft={handleSaveDraft}
              onSimulate={handleSimulateMinigame}
              onRequestReview={handleRequestReview}
              onConfirm={handleConfirmMinigame}
              onRevertVersion={handleRevertVersion}
              onAddComment={handleAddComment}
              onOpenMinigame={(other) => setActiveMinigameCode(other)}
              onClose={() => setActiveMinigameCode(null)}
            />
          )}

          {/* Post-Launch Debrief Modal */}
          {launchOutcome && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
              <div
                className={`w-full max-w-3xl rounded-2xl border-2 shadow-2xl overflow-hidden ${
                  launchOutcome.success
                    ? 'bg-[#081512] border-emerald-500'
                    : 'bg-[#190B0E] border-rose-500'
                }`}
              >
                <div
                  className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${
                    launchOutcome.success
                      ? 'bg-[#0C211B] border-emerald-500/40'
                      : 'bg-[#280F14] border-rose-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {launchOutcome.success ? (
                      <Rocket className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-slate-300">
                        Flight Report · Phase {launchOutcome.currentPhase}/6
                      </div>
                      <h2 className="font-display text-xl font-bold text-white">
                        {launchOutcome.headline}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-slate-700/80 bg-black/40 p-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                        Evaluated Phase
                      </div>
                      <div className="font-display text-xs font-bold text-white mt-0.5">
                        Phase {launchOutcome.currentPhase}/6 · {launchOutcome.phaseTitle}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 bg-black/40 p-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                        Destination
                      </div>
                      <div className="font-display text-xs font-bold text-sky-300 mt-0.5">
                        {launchOutcome.destinationName}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 bg-black/40 p-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                        Altitude / Outcome
                      </div>
                      <div
                        className={`font-mono-tabular text-xs font-bold mt-0.5 ${
                          launchOutcome.success ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {launchOutcome.finalAltitudeLabel}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 bg-black/40 p-2.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                        Peak Velocity
                      </div>
                      <div className="font-mono-tabular text-xs font-bold text-amber-300 mt-0.5">
                        {launchOutcome.peakVelocityLabel}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 space-y-1.5 ${
                      launchOutcome.success
                        ? 'border-emerald-500/40 bg-[#0A1F18]'
                        : 'border-rose-500/50 bg-[#230E13]'
                    }`}
                  >
                    <div className="text-sm font-display font-bold text-white">
                      {launchOutcome.rootCauseHeadline}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {launchOutcome.narrative}
                    </p>
                  </div>

                  {launchOutcome.failureReasons.length > 0 && (
                    <div className="rounded-xl border border-rose-500/50 bg-black/40 p-3.5 space-y-1.5">
                      <div className="text-xs font-display font-bold text-rose-300 uppercase tracking-wider">
                        Pending Annex C Requirements &amp; Gates
                      </div>
                      <ul className="space-y-1">
                        {launchOutcome.failureReasons.map((reason, i) => (
                          <li key={i} className="text-xs text-rose-100 flex items-start gap-2">
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {launchOutcome.passedChecks.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/40 bg-black/40 p-3.5 space-y-1.5">
                      <div className="text-xs font-display font-bold text-emerald-300 uppercase tracking-wider">
                        Verified Systems
                      </div>
                      <ul className="space-y-1">
                        {launchOutcome.passedChecks.map((check, i) => (
                          <li key={i} className="text-xs text-emerald-100 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{check}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleResetLaunch}
                      className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-200 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Return to Complex</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tablet HUD */}
          <TabletHud
            isOpen={tabletOpen}
            onOpenChange={handleSetTabletOpen}
            activeRole={activeRole}
            activeRoom={activeRoom}
            difficulty={difficulty}
            currentPhase={currentPhase}
            soloTestMode={soloTestMode}
            resources={resources}
            sharedState={sharedState}
            minigameStates={minigameStates}
            installedModuleIds={installedModuleIds}
            activeConflicts={activeConflicts}
            emergencyAlert={emergencyAlert}
            cargoStates={cargoStates}
            explodedView={explodedView}
            isLaunching={isLaunching}
            onOpenMinigame={handleOpenMinigame}
            onAdvancePhase={handleAdvancePhase}
            onSelectRoom={handleSelectRoom}
            onToggleExploded={() => setExplodedView((v) => !v)}
            onTriggerLaunch={handleTriggerLaunch}
            onResetLaunch={handleResetLaunch}
            onCallEmergencyMeeting={handleCallEmergencyMeeting}
            onCancelRedAlert={handleCancelRedAlert}
            orbitalTrajectory={orbitalTrajectory}
            thermalReport={thermalReport}
            budgetAllocation={budgetAllocation}
          />
        </>
      )}
    </main>
  );
}
