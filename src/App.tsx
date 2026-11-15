import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioSettingsState,
  AudioVolumeChannel,
  loadAudioSettings,
} from './audio/audioSettings';
import { GameHud } from './components/GameHud';
import { GameplayHud, WorkshopTab } from './components/GameplayHud';
import { TouchControls } from './components/TouchControls';
import { DEV_TELEPORT_POINTS } from './game/devLocations';
import { ForestExplorerEngine } from './game/engine';
import { createInitialSaveState, WORLD_SEED } from './game/persistence';
import {
  ActiveDialogue,
  GraphicsQuality,
  InteractPrompt,
  PlayerVitals,
  ThornvaleSaveState,
  TouchMoveInput,
} from './game/types';
import { computeDayNightAtmosphere } from './systems/ExplorationSystem';
import {
  DynamicEventKind,
  ExplorationAtmosphereState,
} from './types/exploration';
import {
  BuildableStructureId,
  GearSlot,
  PlacementPreviewState,
  PlayerSurvivalState,
} from './types/gameplay';

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

const QUALITY_ORDER: GraphicsQuality[] = ['low', 'retro', 'high'];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ForestExplorerEngine | null>(null);
  const bannerTimerRef = useRef<number>(0);

  const [zoneName, setZoneName] = useState('The Moss Clearing');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettingsState>(() =>
    loadAudioSettings()
  );
  const [lanternEnabled, setLanternEnabled] = useState(true);
  const [touchEnabled, setTouchEnabled] = useState(() => isTouchDevice());
  const [quality, setQuality] = useState<GraphicsQuality>(() =>
    isTouchDevice() ? 'low' : 'retro'
  );
  const [vhsEnabled, setVhsEnabled] = useState(true);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const [interactPrompt, setInteractPrompt] = useState<InteractPrompt | null>(null);
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null);
  const [vitals, setVitals] = useState<PlayerVitals>({
    hp: 100,
    maxHp: 100,
    inCombat: false,
    hurtFlash: 0,
  });
  const [survival, setSurvival] = useState<PlayerSurvivalState>({
    stamina: 100,
    maxStamina: 100,
    warmth: 74,
    maxWarmth: 100,
    nearFire: false,
    inShelter: false,
    nearbyStations: ['hand'],
  });
  const [placement, setPlacement] = useState<PlacementPreviewState>({
    active: false,
    structureId: null,
    structureName: '',
    valid: false,
    reason: '',
    rotY: 0,
  });
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('craft');
  const [stashOpen, setStashOpen] = useState(false);

  const [atmosphere, setAtmosphere] = useState<ExplorationAtmosphereState>(() =>
    computeDayNightAtmosphere(13.25)
  );
  const [transitionFading, setTransitionFading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<ThornvaleSaveState>(() =>
    createInitialSaveState(WORLD_SEED)
  );

  const showTransientBanner = useCallback((msg: string | null) => {
    window.clearTimeout(bannerTimerRef.current);
    setBannerMessage(msg);
    if (msg) {
      bannerTimerRef.current = window.setTimeout(() => {
        setBannerMessage(null);
      }, 2800);
    }
  }, []);

  useEffect(() => {
    engineRef.current?.setInputPaused(inventoryOpen || workshopOpen || stashOpen);
  }, [inventoryOpen, workshopOpen, stashOpen]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const initialQuality: GraphicsQuality = isTouchDevice() ? 'low' : 'retro';
    const engine = new ForestExplorerEngine(
      mountEl,
      {
        onZoneChange: (name) => setZoneName(name),
        onWebGLContextLost: (lost) => setContextLost(lost),
        onAudioStateChange: (enabled) => setAudioEnabled(enabled),
        onQualityChange: (q) => setQuality(q),
        onInteractPromptChange: (prompt) => setInteractPrompt(prompt),
        onDialogueChange: (active) => setDialogue(active),
        onPlayerVitalsChange: (v) => setVitals(v),
        onSurvivalChange: (s) => setSurvival(s),
        onPlacementChange: (p) => setPlacement(p),
        onStashModalChange: (open) => {
          setStashOpen(open);
          if (open) setWorkshopOpen(false);
        },
        onRequestOpenWorkshop: (tab = 'craft') => {
          setWorkshopTab(tab);
          setWorkshopOpen(true);
          setStashOpen(false);
        },
        onTransitionChange: (fading) => setTransitionFading(fading),
        onDiscovery: (placeName, count, total) => {
          showTransientBanner(`Discovered — ${placeName} (${count}/${total})`);
        },
        onStatusMessage: (msg) => showTransientBanner(msg),
        onSaveStateChange: (state) => setSaveState(state),
        onDevModeChange: (enabled) => setDevModeEnabled(enabled),
        onAtmosphereChange: (atm) => setAtmosphere(atm),
      },
      initialQuality
    );
    engineRef.current = engine;
    (window as unknown as { __tvEngine?: ForestExplorerEngine }).__tvEngine = engine;

    const onKeySync = (e: KeyboardEvent) => {
      if (e.code === 'KeyL') {
        setLanternEnabled(engine.isLanternOn());
      }
    };
    window.addEventListener('keyup', onKeySync);

    return () => {
      window.clearTimeout(bannerTimerRef.current);
      window.removeEventListener('keyup', onKeySync);
      delete (window as unknown as { __tvEngine?: ForestExplorerEngine }).__tvEngine;
      engine.dispose();
      engineRef.current = null;
    };
  }, [showTransientBanner]);

  const handleToggleAudio = useCallback(() => {
    if (!engineRef.current) return;
    const next = engineRef.current.toggleAudio();
    setAudioEnabled(next);
  }, []);

  const handleChangeAudioVolume = useCallback(
    (channel: AudioVolumeChannel, value: number) => {
      if (!engineRef.current) return;
      const next = engineRef.current.setAudioChannelVolume(channel, value);
      setAudioSettings(next);
    },
    []
  );

  const handleResetAudioSettings = useCallback(() => {
    if (!engineRef.current) return;
    const next = engineRef.current.resetAudioSettings();
    setAudioSettings(next);
  }, []);

  const handleToggleLantern = useCallback(() => {
    if (!engineRef.current) return;
    const next = engineRef.current.toggleLantern();
    setLanternEnabled(next);
  }, []);

  const handleResetCamera = useCallback(() => {
    engineRef.current?.resetCamera();
  }, []);

  const handleInteract = useCallback(() => {
    engineRef.current?.triggerInteract();
  }, []);

  const handleAdvanceDialogue = useCallback(() => {
    engineRef.current?.advanceDialogue();
  }, []);

  const handleCloseDialogue = useCallback(() => {
    engineRef.current?.closeDialogue();
  }, []);

  const handleAttack = useCallback(() => {
    engineRef.current?.triggerAttack();
  }, []);

  const handleResetSave = useCallback(() => {
    engineRef.current?.resetWorldSave();
  }, []);

  const handleCycleQuality = useCallback(() => {
    if (!engineRef.current) return;
    setQuality((prev) => {
      const idx = QUALITY_ORDER.indexOf(prev);
      const next = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
      engineRef.current?.setQuality(next);
      return next;
    });
  }, []);

  const handleToggleVhs = useCallback(() => {
    setVhsEnabled((prev) => {
      const next = !prev;
      engineRef.current?.setVhsEnabled(next);
      return next;
    });
  }, []);

  const handleToggleDevMode = useCallback((enabled: boolean) => {
    engineRef.current?.setDevMode(enabled);
  }, []);

  const handleDevTeleport = useCallback((locationId: string) => {
    engineRef.current?.teleportToDevLocation(locationId);
  }, []);

  const handleDevReturnNormal = useCallback(() => {
    engineRef.current?.returnFromDevTeleport();
  }, []);

  const handleTouchMove = useCallback((input: TouchMoveInput) => {
    engineRef.current?.setTouchMove(input);
  }, []);

  const handleTouchJump = useCallback(() => {
    engineRef.current?.triggerJump();
  }, []);

  const handleTouchSprint = useCallback((active: boolean) => {
    engineRef.current?.setTouchSprint(active);
  }, []);

  const handleTouchCrouch = useCallback((active: boolean) => {
    engineRef.current?.setTouchCrouch(active);
  }, []);

  const handleMoveInventorySlot = useCallback((fromIdx: number, toIdx: number) => {
    engineRef.current?.moveInventorySlot(fromIdx, toIdx);
  }, []);

  const handleSplitInventorySlot = useCallback((slotIdx: number) => {
    engineRef.current?.splitInventorySlot(slotIdx);
  }, []);

  const handleDiscardInventoryItem = useCallback((slotIdx: number, amount?: number) => {
    engineRef.current?.discardInventoryItem(slotIdx, amount);
  }, []);

  const handleEquipInventorySlot = useCallback((slotIdx: number) => {
    engineRef.current?.equipInventorySlot(slotIdx);
  }, []);

  const handleUseInventorySlot = useCallback((slotIdx: number) => {
    engineRef.current?.useInventorySlot(slotIdx);
  }, []);

  const handleToggleWorkshop = useCallback(
    (tab?: WorkshopTab) => {
      setStashOpen(false);
      if (tab) {
        setWorkshopOpen((open) => {
          if (open && workshopTab === tab) return false;
          setWorkshopTab(tab);
          return true;
        });
      } else {
        setWorkshopOpen((open) => !open);
      }
    },
    [workshopTab]
  );

  const handleCloseWorkshopAndStash = useCallback(() => {
    setWorkshopOpen(false);
    setStashOpen(false);
  }, []);

  const handleCraftRecipe = useCallback((recipeId: string) => {
    engineRef.current?.craftRecipe(recipeId);
  }, []);

  const handleStartPlacement = useCallback((structureId: BuildableStructureId) => {
    if (engineRef.current?.startStructurePlacement(structureId)) {
      setWorkshopOpen(false);
      setStashOpen(false);
    }
  }, []);

  const handleConfirmPlacement = useCallback(() => {
    engineRef.current?.confirmStructurePlacement();
  }, []);

  const handleRotatePlacement = useCallback(() => {
    engineRef.current?.rotateStructurePlacement();
  }, []);

  const handleCancelPlacement = useCallback(() => {
    engineRef.current?.cancelStructurePlacement();
  }, []);

  const handleDismantleStructure = useCallback((recordId: string) => {
    engineRef.current?.dismantleStructure(recordId);
  }, []);

  const handleUnequipSlot = useCallback((slot: GearSlot) => {
    engineRef.current?.unequipGearSlot(slot);
  }, []);

  const handleTransferPackToStash = useCallback((packIdx: number) => {
    engineRef.current?.transferPackToStash(packIdx);
  }, []);

  const handleTransferStashToPack = useCallback((stashIdx: number) => {
    engineRef.current?.transferStashToPack(stashIdx);
  }, []);

  const handleClaimQuest = useCallback((questId: string) => {
    engineRef.current?.claimQuestReward(questId);
  }, []);

  const handleSetDevTime = useCallback((hour: number | null) => {
    engineRef.current?.setDevTimePreset(hour);
  }, []);

  const handleToggleDevCycle = useCallback(() => {
    engineRef.current?.toggleDevTimeCyclePaused();
  }, []);

  const handleTriggerDevEvent = useCallback((kind?: DynamicEventKind) => {
    engineRef.current?.triggerDevDynamicEvent(kind);
  }, []);

  const handleClearDevEvents = useCallback(() => {
    engineRef.current?.clearDevDynamicEvents();
  }, []);

  const handleSetDevMechanisms = useCallback((open: boolean) => {
    engineRef.current?.setDevMechanismsOpen(open);
  }, []);

  const handleRevealDevJournal = useCallback(() => {
    engineRef.current?.revealDevSecretsAndJournal();
  }, []);

  const handleSpawnDevChest = useCallback(() => {
    engineRef.current?.spawnDevTestChest();
  }, []);

  const combatStats = engineRef.current
    ? engineRef.current.getCombatStats()
    : {
        attackDamage: 22,
        defenseReduction: 0,
        warmthBonus: 0,
        ownedTools: { axe: false, pickaxe: false },
      };

  const activeEnvironmentId = engineRef.current
    ? engineRef.current.getActiveEnvironmentId()
    : 'overworld';

  const devExplorationSnapshot =
    devModeEnabled && engineRef.current
      ? engineRef.current.getDevExplorationSnapshot()
      : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#182028]">
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Smooth Crossfade Curtain During Interior / Exterior Transitions */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-40 bg-[#080a0c] transition-opacity duration-200 ${
          transitionFading ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141a20]/95 p-6 text-center">
          <div className="max-w-sm rounded-xl border border-white/15 bg-[#1d252c] px-6 py-5">
            <h2 className="font-display text-base font-medium text-[#e8e2d5]">
              Display Context Interrupted
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#a7b2bc]">
              Graphics context was suspended by the browser. Reload the page if the forest scene does not automatically resume.
            </p>
          </div>
        </div>
      )}

      {touchEnabled && (
        <TouchControls
          onMove={handleTouchMove}
          onJump={handleTouchJump}
          onSprintChange={handleTouchSprint}
          onCrouchChange={handleTouchCrouch}
          onAttack={handleAttack}
          interactPrompt={dialogue ? null : interactPrompt}
          onInteract={handleInteract}
        />
      )}

      <GameHud
        zoneName={zoneName}
        audioEnabled={audioEnabled}
        lanternEnabled={lanternEnabled}
        touchEnabled={touchEnabled}
        quality={quality}
        vhsEnabled={vhsEnabled}
        devModeEnabled={devModeEnabled}
        devTeleportLocations={DEV_TELEPORT_POINTS}
        interactPrompt={interactPrompt}
        dialogue={dialogue}
        vitals={vitals}
        bannerMessage={bannerMessage}
        saveState={saveState}
        onInteract={handleInteract}
        onAdvanceDialogue={handleAdvanceDialogue}
        onCloseDialogue={handleCloseDialogue}
        onToggleAudio={handleToggleAudio}
        onToggleLantern={handleToggleLantern}
        onResetCamera={handleResetCamera}
        onToggleTouch={() => setTouchEnabled((v) => !v)}
        onCycleQuality={handleCycleQuality}
        onToggleVhs={handleToggleVhs}
        onToggleDevMode={handleToggleDevMode}
        onDevTeleport={handleDevTeleport}
        onDevReturnNormal={handleDevReturnNormal}
        onResetSave={handleResetSave}
        onMoveInventorySlot={handleMoveInventorySlot}
        onSplitInventorySlot={handleSplitInventorySlot}
        onDiscardInventoryItem={handleDiscardInventoryItem}
        onEquipInventorySlot={handleEquipInventorySlot}
        onUseInventorySlot={handleUseInventorySlot}
        onInventoryOpenChange={setInventoryOpen}
        survival={survival}
        atmosphere={atmosphere}
        devExplorationSnapshot={devExplorationSnapshot}
        workshopOpen={workshopOpen}
        stashOpen={stashOpen}
        placementActive={placement.active}
        onToggleWorkshop={handleToggleWorkshop}
        onCloseWorkshopAndStash={handleCloseWorkshopAndStash}
        onSetDevTime={handleSetDevTime}
        onToggleDevCycle={handleToggleDevCycle}
        onTriggerDevEvent={handleTriggerDevEvent}
        onClearDevEvents={handleClearDevEvents}
        onSetDevMechanisms={handleSetDevMechanisms}
        onRevealDevJournal={handleRevealDevJournal}
        onSpawnDevChest={handleSpawnDevChest}
        audioSettings={audioSettings}
        onChangeAudioVolume={handleChangeAudioVolume}
        onResetAudioSettings={handleResetAudioSettings}
      />

      <GameplayHud
        saveState={saveState}
        survival={survival}
        placement={placement}
        activeEnvironmentId={activeEnvironmentId}
        combatStats={combatStats}
        atmosphere={atmosphere}
        devModeEnabled={devModeEnabled}
        touchEnabled={touchEnabled}
        workshopOpen={workshopOpen}
        workshopTab={workshopTab}
        stashOpen={stashOpen}
        onChangeWorkshopTab={setWorkshopTab}
        onCloseWorkshop={() => setWorkshopOpen(false)}
        onCloseStash={() => setStashOpen(false)}
        onCraftRecipe={handleCraftRecipe}
        onStartPlacement={handleStartPlacement}
        onConfirmPlacement={handleConfirmPlacement}
        onRotatePlacement={handleRotatePlacement}
        onCancelPlacement={handleCancelPlacement}
        onDismantleStructure={handleDismantleStructure}
        onEquipSlot={handleEquipInventorySlot}
        onUnequipSlot={handleUnequipSlot}
        onUseSlot={handleUseInventorySlot}
        onTransferPackToStash={handleTransferPackToStash}
        onTransferStashToPack={handleTransferStashToPack}
        onClaimQuest={handleClaimQuest}
      />
    </main>
  );
}
