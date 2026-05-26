import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  Cpu,
  ExternalLink as ExternalLinkIcon,
  Server,
  Info,
  Trash2,
  Wifi,
  WifiOff,
  Plus,
  X,
  SlidersHorizontal,
  Keyboard,
  Bookmark,
  Scaling,
  Image as ImageIcon,
  Mouse,
  Touchpad,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { relaunch } from '@tauri-apps/plugin-process';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Show, SignIn, useUser, useAuth, useClerk } from '@clerk/react';
import Button from '../ui/Button';
import ConfirmModal from '../modals/ConfirmModal';
import Dropdown, { OptionItem } from '../ui/Dropdown';
import Switch from '../ui/Switch';
import Input from '../ui/Input';
import Slider from '../ui/Slider';
import { ThemeProps, THEMES, DEFAULT_THEME_ID } from '../../utils/themes';
import { Invokes, Language } from '../ui/AppProperties';
import {
  formatKeyCode,
  KeybindDefinition,
  KEYBIND_DEFINITIONS,
  KEYBIND_SECTIONS,
  normalizeCombo,
} from '../../utils/keyboardUtils';
import Text from '../ui/Text';
import { TextColors, TextVariants, TextWeights } from '../../types/typography';
import { useOsPlatform } from '../../hooks/useOsPlatform';
import { open } from '@tauri-apps/plugin-shell';
import { useTranslation } from 'react-i18next';

interface ConfirmModalState {
  confirmText: string;
  confirmVariant: string;
  isOpen: boolean;
  message: string;
  onConfirm(): void;
  title: string;
}

interface DataActionItemProps {
  buttonAction(): void;
  buttonText: string;
  description: any;
  disabled?: boolean;
  icon: any;
  isProcessing: boolean;
  message: string;
  title: string;
}

interface KeybindRowProps {
  def: KeybindDefinition;
  currentCombo?: string[];
  osPlatform: string;
  onSave: (action: string, combo: string[]) => void;
  recordingAction: string | null;
  onStartRecording: (action: string) => void;
  isConflicting: boolean;
}

interface SettingItemProps {
  children: any;
  description?: string;
  label: string;
}

interface SettingsPanelProps {
  appSettings: any;
  onBack(): void;
  onLibraryRefresh(): void;
  onSettingsChange(settings: any): Promise<void>;
  rootPaths: string[];
}

interface TestStatus {
  message: string;
  success: boolean | null;
  testing: boolean;
}

interface MyLens {
  maker: string;
  model: string;
}

const EXECUTE_TIMEOUT = 3000;

const adjustmentVisibilityDefaults = {
  sharpening: true,
  presence: true,
  noiseReduction: true,
  chromaticAberration: false,
  vignette: true,
  colorCalibration: false,
  grain: true,
};

const resolutions: OptionItem<number>[] = [
  { value: 720, label: '720px' },
  { value: 1280, label: '1280px' },
  { value: 1920, label: '1920px' },
  { value: 2560, label: '2560px' },
  { value: 3840, label: '3840px' },
];

const thumbnailResolutions: OptionItem<number>[] = [
  { value: 640, label: '640px' },
  { value: 720, label: '720px' },
  { value: 960, label: '960px' },
  { value: 1080, label: '1080px' },
];

const zoomMultiplierOptions: OptionItem<number>[] = [
  { value: 1.0, label: 'settings.processing.zoomNative' },
  { value: 0.75, label: 'settings.processing.zoom75x' },
  { value: 0.5, label: 'settings.processing.zoomHalf' },
  { value: 0.25, label: 'settings.processing.zoom25x' },
];

const livePreviewQualityOptions: OptionItem<string>[] = [
  { value: 'full', label: 'settings.processing.livePreviewFull' },
  { value: 'high', label: 'settings.processing.livePreviewHigh' },
  { value: 'performance', label: 'settings.processing.livePreviewPerformance' },
];

const _livePreviewQualityOptionKeys: Record<string, string> = {
  full: 'settings.processing.livePreviewFull',
  high: 'settings.processing.livePreviewHigh',
  performance: 'settings.processing.livePreviewPerformance',
};

const backendOptions: OptionItem<string>[] = [
  { value: 'auto', label: 'settings.processing.auto' },
  { value: 'vulkan', label: 'Vulkan' },
  { value: 'dx12', label: 'DirectX 12' },
  { value: 'metal', label: 'Metal' },
  { value: 'gl', label: 'OpenGL' },
];

const linearRawOptions: OptionItem<string>[] = [
  { value: 'auto', label: 'settings.processing.auto' },
  { value: 'gamma', label: 'settings.processing.applyGamma' },
  { value: 'skip_calib', label: 'settings.processing.skipCalibrate' },
  { value: 'gamma_skip_calib', label: 'settings.processing.applyGammaSkipCalibrate' },
];

const languageOptions: OptionItem<string>[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文 (Chinese)' },
];

const tonemapperOptions: OptionItem<string>[] = [
  { value: 'agx', label: 'settings.processing.agx' },
  { value: 'basic', label: 'settings.processing.basic' },
];

const settingCategories = [
  { id: 'general', label: 'settings.general.title', icon: SlidersHorizontal, i18nKey: 'settings.general.title' },
  { id: 'processing', label: 'settings.processing.title', icon: Cpu, i18nKey: 'settings.processing.title' },
  { id: 'shortcuts', label: 'settings.controls', icon: Keyboard, i18nKey: 'settings.controls' },
];

const KeybindRow = ({
  def,
  currentCombo,
  osPlatform,
  onSave,
  recordingAction,
  onStartRecording,
  isConflicting,
}: KeybindRowProps) => {
  const { t } = useTranslation();
  const recording = recordingAction === def.action;

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSave(def.action, []);
        onStartRecording('');
        return;
      }
      e.preventDefault();
      const parts = normalizeCombo(e, osPlatform);
      if (parts.length > 0 && !['ctrl', 'shift', 'alt'].includes(parts[parts.length - 1])) {
        onSave(def.action, parts);
        onStartRecording('');
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [recording, def.action, onSave, onStartRecording]);

  const displayCombo = currentCombo !== undefined ? (currentCombo.length ? currentCombo : null) : def.defaultCombo;

  return (
    <div className="flex justify-between items-center py-2">
      <Text variant={TextVariants.label}>{t(def.description)}</Text>
      <div className="flex items-center gap-1">
        {isConflicting && <span className="text-yellow-400 text-xs">⚠</span>}
        <button onClick={() => onStartRecording(def.action)} className="flex items-center gap-1 flex-wrap shrink-0">
          {recording ? (
            <Text
              as="kbd"
              variant={TextVariants.small}
              color={TextColors.accent}
              weight={TextWeights.semibold}
              className="px-2 py-1 font-sans bg-bg-primary border border-accent rounded-md animate-pulse"
            >
              {t('settings.keyboard.pressKey')}
            </Text>
          ) : (
            <Text
              as="kbd"
              variant={TextVariants.small}
              color={TextColors.primary}
              weight={TextWeights.semibold}
              className={`px-2 py-1 font-sans bg-bg-primary border rounded-md cursor-pointer hover:border-accent transition-colors ${isConflicting ? 'border-yellow-400' : 'border-border-color'}`}
            >
              {displayCombo ? (
                displayCombo.map((k) => formatKeyCode(k, osPlatform)).join(' + ')
              ) : (
                <span className="text-text-secondary italic">{t('settings.keyboard.notAssigned')}</span>
              )}
            </Text>
          )}
        </button>
      </div>
    </div>
  );
};

const SettingItem = ({ children, description, label }: SettingItemProps) => (
  <div>
    <Text variant={TextVariants.heading} className="block mb-2">
      {label}
    </Text>
    {children}
    {description && (
      <Text variant={TextVariants.small} className="mt-2">
        {description}
      </Text>
    )}
  </div>
);

const DataActionItem = ({
  buttonAction,
  buttonText,
  description,
  disabled = false,
  icon,
  isProcessing,
  message,
  title,
}: DataActionItemProps) => {
  const { t } = useTranslation();
  return (
  <div className="pb-8 border-b border-border-color last:border-b-0 last:pb-0">
    <Text variant={TextVariants.heading} className="mb-2">
      {title}
    </Text>
    <Text variant={TextVariants.small} className="mb-3">
      {description}
    </Text>
    <Button variant="destructive" onClick={buttonAction} disabled={isProcessing || disabled}>
      {icon}
      {isProcessing ? t('common.processing') : buttonText}
    </Button>
    {message && (
      <Text color={TextColors.accent} className="mt-3">
        {message}
      </Text>
    )}
  </div>
  );
};

const aiProviders = [
  { id: 'cpu', label: 'settings.ai.cpu', icon: Cpu },
  { id: 'ai-connector', label: 'settings.ai.aiConnector', icon: Server },
  { id: 'cloud', label: 'settings.ai.cloud', icon: Cloud },
];

interface AiProviderSwitchProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

const AiProviderSwitch = ({ selectedProvider, onProviderChange }: AiProviderSwitchProps) => {
  const { t } = useTranslation();
  return (
    <div className="relative flex w-full p-1 bg-bg-primary rounded-md border border-border-color">
      {aiProviders.map((provider) => (
        <button
          key={provider.id}
          onClick={() => onProviderChange(provider.id)}
          className={clsx(
            'relative flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            {
              'text-text-primary hover:bg-surface': selectedProvider !== provider.id,
              'text-button-text': selectedProvider === provider.id,
            },
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {selectedProvider === provider.id && (
            <motion.span
              layoutId="ai-provider-switch-bubble"
              className="absolute inset-0 z-0 bg-accent"
              style={{ borderRadius: 6 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center">
            <provider.icon size={16} className="mr-2" />
            {t(provider.label)}
          </span>
        </button>
      ))}
    </div>
  );
};

const CloudDashboard = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [usage, setUsage] = useState<{ requests: number; limit: number; month: string } | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('https://getrapidraw.com/api/usage', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setUsage(await res.json());
        }
      } catch (e) {
        console.error('Failed to fetch cloud usage', e);
      }
    };
    fetchUsage();
  }, [getToken]);

  const isPro = user?.publicMetadata?.plan === 'pro';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border-color pb-4">
        <div className="flex items-center gap-3">
          <div>
            <Text variant={TextVariants.heading}>{user?.fullName || user?.primaryEmailAddress?.emailAddress}</Text>
            <Text variant={TextVariants.small} color={isPro ? TextColors.success : TextColors.error}>
              {isPro ? t('settings.cloud.subscriptionActive') : t('settings.cloud.noActiveSubscription')}
            </Text>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface border-none shadow-none"
            onClick={() => open('https://www.getrapidraw.com/dashboard')}
          >
            Manage <ExternalLinkIcon size={14} className="ml-1" />
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut();
            }}
          >
            Log Out
          </Button>
        </div>
      </div>

      {isPro ? (
        <div className="bg-surface p-4 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <Text variant={TextVariants.label}>{t('monthlyUsage')}</Text>
            <Text variant={TextVariants.small}>
              {usage?.requests ?? 0} / {usage?.limit ?? 500} requests
            </Text>
          </div>
          <div className="w-full bg-bg-primary rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((usage?.requests ?? 0) / (usage?.limit ?? 500)) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="bg-red-900/10 border border-red-500/50 p-4 rounded-md text-center">
          <Text className="mb-3">{t('settings.cloud.needSubscription')}</Text>
          <Button onClick={() => open('https://www.getrapidraw.com/cloud')}>{t('settings.cloud.upgrade')}</Button>
        </div>
      )}
    </div>
  );
};

const canvasInputModes = [
  { id: 'mouse', label: 'settings.input.mouse', icon: Mouse },
  { id: 'trackpad', label: 'settings.input.trackpad', icon: Touchpad },
];

interface CanvasInputModeSwitchProps {
  mode: 'mouse' | 'trackpad';
  onModeChange: (mode: 'mouse' | 'trackpad') => void;
}

const CanvasInputModeSwitch = ({ mode, onModeChange }: CanvasInputModeSwitchProps) => {
  const { t } = useTranslation();
  return (
    <div className="relative flex w-full p-1 bg-bg-primary rounded-md border border-border-color">
      {canvasInputModes.map((item) => (
        <button
          key={item.id}
          onClick={() => onModeChange(item.id as 'mouse' | 'trackpad')}
          className={clsx(
            'relative flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            {
              'text-text-primary hover:bg-surface': mode !== item.id,
              'text-button-text': mode === item.id,
            },
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {mode === item.id && (
            <motion.span
              layoutId="canvas-input-mode-switch-bubble"
              className="absolute inset-0 z-0 bg-accent"
              style={{ borderRadius: 6 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center">
            <item.icon size={16} className="mr-2" />
            {t(item.label)}
          </span>
        </button>
      ))}
    </div>
  );
};

const previewModes = [
  { id: 'static', label: 'settings.preview.fixedResolution', icon: ImageIcon },
  { id: 'dynamic', label: 'settings.preview.dynamic', icon: Scaling },
];

interface PreviewModeSwitchProps {
  mode: 'static' | 'dynamic';
  onModeChange: (mode: 'static' | 'dynamic') => void;
}

const PreviewModeSwitch = ({ mode, onModeChange }: PreviewModeSwitchProps) => {
  const { t } = useTranslation();
  return (
    <div className="relative flex w-full p-1 bg-bg-primary rounded-md border border-border-color">
      {previewModes.map((item) => (
        <button
          key={item.id}
          onClick={() => onModeChange(item.id as 'static' | 'dynamic')}
          className={clsx(
            'relative flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            {
              'text-text-primary hover:bg-surface': mode !== item.id,
              'text-button-text': mode === item.id,
            },
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {mode === item.id && (
            <motion.span
              layoutId="preview-mode-switch-bubble"
              className="absolute inset-0 z-0 bg-accent"
              style={{ borderRadius: 6 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center">
            <item.icon size={16} className="mr-2" />
            {t(item.label)}
          </span>
        </button>
      ))}
    </div>
  );
};

export default function SettingsPanel({
  appSettings,
  onBack,
  onLibraryRefresh,
  onSettingsChange,
  rootPaths,
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const { user: _user } = useUser();
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearMessage, setCacheClearMessage] = useState('');
  const [isClearingAiTags, setIsClearingAiTags] = useState(false);
  const [aiTagsClearMessage, setAiTagsClearMessage] = useState('');
  const [isClearingTags, setIsClearingTags] = useState(false);
  const [tagsClearMessage, setTagsClearMessage] = useState('');
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({
    confirmText: t('common.confirm'),
    confirmVariant: 'primary',
    isOpen: false,
    message: '',
    onConfirm: () => {},
    title: '',
  });
  const [testStatus, setTestStatus] = useState<TestStatus>({ message: '', success: null, testing: false });
  const [hasInteractedWithLivePreview, setHasInteractedWithLivePreview] = useState(false);
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  const [aiProvider, setAiProvider] = useState(appSettings?.aiProvider || 'cpu');
  const [aiConnectorAddress, setAiConnectorAddress] = useState<string>(appSettings?.aiConnectorAddress || '');
  const [newShortcut, setNewShortcut] = useState('');
  const [newAiTag, setNewAiTag] = useState('');

  const [lensMakers, setLensMakers] = useState<string[]>([]);
  const [lensModels, setLensModels] = useState<string[]>([]);
  const [tempLensMaker, setTempLensMaker] = useState<string>('');
  const [tempLensModel, setTempLensModel] = useState<string>('');

  const osPlatform = useOsPlatform();
  const [processingSettings, setProcessingSettings] = useState({
    editorPreviewResolution: appSettings?.editorPreviewResolution || 1920,
    thumbnailResolution: appSettings?.thumbnailResolution || 720,
    rawHighlightCompression: appSettings?.rawHighlightCompression ?? 2.5,
    processingBackend: appSettings?.processingBackend || 'auto',
    linuxGpuOptimization: appSettings?.linuxGpuOptimization ?? false,
    highResZoomMultiplier: appSettings?.highResZoomMultiplier || 1.0,
    useFullDpiRendering: appSettings?.useFullDpiRendering ?? false,
    useWgpuRenderer:
      appSettings?.useWgpuRenderer ?? (osPlatform === 'linux' || osPlatform === 'android' ? false : true),
    thumbnailWorkerThreads: appSettings?.thumbnailWorkerThreads ?? 4,
    imageCacheSize: appSettings?.imageCacheSize ?? 5,
    rawPreprocessingColorNr: appSettings?.rawPreprocessingColorNr ?? 0.5,
    rawPreprocessingSharpening: appSettings?.rawPreprocessingSharpening ?? 0.35,
    applyPreprocessingToNonRaws: appSettings?.applyPreprocessingToNonRaws ?? false,
  });
  const [restartRequired, setRestartRequired] = useState(false);
  const [activeCategory, setActiveCategory] = useState('general');
  const [logPath, setLogPath] = useState('');
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? window.devicePixelRatio : 1));

  const filteredBackendOptions = backendOptions.filter((opt) => {
    if (opt.value === 'metal' && osPlatform !== 'macos') return false;
    if (opt.value === 'dx12' && osPlatform === 'macos') return false;
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateDpr = () => setDpr(window.devicePixelRatio);

    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mediaQuery.addEventListener('change', updateDpr);

    window.addEventListener('resize', updateDpr);

    return () => {
      mediaQuery.removeEventListener('change', updateDpr);
      window.removeEventListener('resize', updateDpr);
    };
  }, []);

  const customAiTags = Array.from(new Set<string>(appSettings?.customAiTags || []));
  const taggingShortcuts = Array.from(new Set<string>(appSettings?.taggingShortcuts || []));

  useEffect(() => {
    if (appSettings?.aiConnectorAddress !== aiConnectorAddress) {
      setAiConnectorAddress(appSettings?.aiConnectorAddress || '');
    }
    if (appSettings?.aiProvider !== aiProvider) {
      setAiProvider(appSettings?.aiProvider || 'cpu');
    }
    setProcessingSettings({
      editorPreviewResolution: appSettings?.editorPreviewResolution || 1920,
      thumbnailResolution: appSettings?.thumbnailResolution || 720,
      rawHighlightCompression: appSettings?.rawHighlightCompression ?? 2.5,
      processingBackend: appSettings?.processingBackend || 'auto',
      linuxGpuOptimization: appSettings?.linuxGpuOptimization ?? false,
      highResZoomMultiplier: appSettings?.highResZoomMultiplier || 1.0,
      useFullDpiRendering: appSettings?.useFullDpiRendering ?? false,
      useWgpuRenderer: appSettings?.useWgpuRenderer ?? true,
      thumbnailWorkerThreads: appSettings?.thumbnailWorkerThreads ?? 4,
      imageCacheSize: appSettings?.imageCacheSize ?? 5,
      rawPreprocessingColorNr: appSettings?.rawPreprocessingColorNr ?? 0.5,
      rawPreprocessingSharpening: appSettings?.rawPreprocessingSharpening ?? 0.35,
      applyPreprocessingToNonRaws: appSettings?.applyPreprocessingToNonRaws ?? false,
    });
    setRestartRequired(false);
  }, [appSettings]);

  useEffect(() => {
    const fetchLogPath = async () => {
      try {
        const path: string = await invoke(Invokes.GetLogFilePath);
        setLogPath(path);
      } catch (error) {
        console.error('Failed to get log file path:', error);
        setLogPath('Could not retrieve log file path.');
      }
    };
    fetchLogPath();

    invoke('get_lensfun_makers')
      .then((m: any) => setLensMakers(m))
      .catch(console.error);
  }, []);

  const handleProcessingSettingChange = async (key: string, value: any) => {
    setProcessingSettings((prev) => ({ ...prev, [key]: value }));

    if (
      key === 'processingBackend' ||
      key === 'linuxGpuOptimization' ||
      key === 'useWgpuRenderer' ||
      key === 'thumbnailWorkerThreads'
    ) {
      setRestartRequired(true);
    } else {
      await onSettingsChange({ ...appSettings, [key]: value });
      if (
        key === 'rawHighlightCompression' ||
        key === 'rawPreprocessingColorNr' ||
        key === 'rawPreprocessingSharpening' ||
        key === 'applyPreprocessingToNonRaws'
      ) {
        await invoke('clear_image_caches');
      }
    }
  };

  const handleSaveAndRelaunch = async () => {
    await onSettingsChange({
      ...appSettings,
      ...processingSettings,
    });
    await relaunch();
  };

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    onSettingsChange({ ...appSettings, aiProvider: provider });
  };

  const handlePreviewModeChange = (mode: 'static' | 'dynamic') => {
    const enableZoomHifi = mode === 'dynamic';
    onSettingsChange({ ...appSettings, enableZoomHifi });
  };

  const handleTempMakerChange = (maker: string) => {
    setTempLensMaker(maker);
    setTempLensModel('');
    setLensModels([]);
    if (maker) {
      invoke('get_lensfun_lenses_for_maker', { maker })
        .then((l: any) => setLensModels(l))
        .catch(console.error);
    }
  };

  const handleAddLens = () => {
    if (tempLensMaker && tempLensModel) {
      const currentLenses: MyLens[] = appSettings?.myLenses || [];
      if (!currentLenses.some((l) => l.maker === tempLensMaker && l.model === tempLensModel)) {
        const newLenses = [...currentLenses, { maker: tempLensMaker, model: tempLensModel }];

        newLenses.sort((a, b) => {
          const makerComp = a.maker.localeCompare(b.maker);
          if (makerComp !== 0) return makerComp;
          return a.model.localeCompare(b.model);
        });

        onSettingsChange({
          ...appSettings,
          myLenses: newLenses,
        });
        setTempLensMaker('');
        setTempLensModel('');
        setLensModels([]);
      }
    }
  };

  const handleRemoveLens = (index: number) => {
    const currentLenses: MyLens[] = appSettings?.myLenses || [];
    const newLenses = [...currentLenses];
    newLenses.splice(index, 1);
    onSettingsChange({ ...appSettings, myLenses: newLenses });
  };

  const effectiveRootPaths = rootPaths?.length > 0 ? rootPaths : appSettings?.rootFolders || [];

  const executeClearSidecars = async () => {
    setIsClearing(true);
    setClearMessage(t('settings.deletingSidecarFiles'));
    try {
      let totalCount = 0;
      for (const root of effectiveRootPaths) {
        const count: number = await invoke(Invokes.ClearAllSidecars, { rootPath: root });
        totalCount += count;
      }
      setClearMessage(t('settings.sidecarFilesDeleted', { count: totalCount }));
      onLibraryRefresh();
    } catch (err: any) {
      console.error('Failed to clear sidecars:', err);
      setClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearing(false);
        setClearMessage('');
      }, EXECUTE_TIMEOUT);
    }
  };

  const handleClearSidecars = () => {
    setConfirmModalState({
      confirmText: t('settings.deleteAllEdits'),
      confirmVariant: 'destructive',
      isOpen: true,
      message: t('settings.confirmDeleteSidecarsDesc'),
      onConfirm: executeClearSidecars,
      title: t('settings.confirmDeletion'),
    });
  };

  const executeClearAiTags = async () => {
    setIsClearingAiTags(true);
    setAiTagsClearMessage(t('settings.clearingAiTags'));
    try {
      let totalCount = 0;
      for (const root of effectiveRootPaths) {
        const count: number = await invoke(Invokes.ClearAiTags, { rootPath: root });
        totalCount += count;
      }
      setAiTagsClearMessage(t('settings.aiTagsCleared', { count: totalCount }));
      onLibraryRefresh();
    } catch (err: any) {
      console.error('Failed to clear AI tags:', err);
      setAiTagsClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearingAiTags(false);
        setAiTagsClearMessage('');
      }, EXECUTE_TIMEOUT);
    }
  };

  const handleClearAiTags = () => {
    setConfirmModalState({
      confirmText: t('settings.clearAiTags'),
      confirmVariant: 'destructive',
      isOpen: true,
      message: t('settings.confirmClearAiTagsDesc'),
      onConfirm: executeClearAiTags,
      title: t('settings.confirmAiTagDeletion'),
    });
  };

  const executeClearTags = async () => {
    setIsClearingTags(true);
    setTagsClearMessage(t('settings.clearingAllTags'));
    try {
      let totalCount = 0;
      for (const root of effectiveRootPaths) {
        const count: number = await invoke(Invokes.ClearAllTags, { rootPath: root });
        totalCount += count;
      }
      setTagsClearMessage(t('settings.allTagsCleared', { count: totalCount }));
      onLibraryRefresh();
    } catch (err: any) {
      console.error('Failed to clear tags:', err);
      setTagsClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearingTags(false);
        setTagsClearMessage('');
      }, EXECUTE_TIMEOUT);
    }
  };

  const handleClearTags = () => {
    setConfirmModalState({
      confirmText: t('settings.clearAllTags'),
      confirmVariant: 'destructive',
      isOpen: true,
      message: t('settings.confirmClearAllTagsDesc'),
      onConfirm: executeClearTags,
      title: t('settings.confirmAllTagDeletion'),
    });
  };

  const shortcutTagVariants = {
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 30 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
  };

  const executeClearCache = async () => {
    setIsClearingCache(true);
    setCacheClearMessage(t('settings.clearingThumbnailCache'));
    try {
      await invoke(Invokes.ClearThumbnailCache);
      setCacheClearMessage(t('settings.thumbnailCacheCleared'));
      onLibraryRefresh();
    } catch (err: any) {
      console.error('Failed to clear thumbnail cache:', err);
      setCacheClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearingCache(false);
        setCacheClearMessage('');
      }, EXECUTE_TIMEOUT);
    }
  };

  const handleClearCache = () => {
    setConfirmModalState({
      confirmText: t('settings.clearCache'),
      confirmVariant: 'destructive',
      isOpen: true,
      message: t('settings.confirmClearCacheDesc'),
      onConfirm: executeClearCache,
      title: t('settings.confirmCacheDeletion'),
    });
  };

  const handleTestConnection = async () => {
    if (!aiConnectorAddress) {
      return;
    }
    setTestStatus({ testing: true, message: t('settings.testingConnection'), success: null });
    try {
      await invoke(Invokes.TestAIConnectorConnection, { address: aiConnectorAddress });
      setTestStatus({ testing: false, message: t('settings.connectionSuccessful'), success: true });
    } catch (err) {
      setTestStatus({ testing: false, message: t('settings.connectionFailed'), success: false });
      console.error('AI Connector connection test failed:', err);
    } finally {
      setTimeout(() => setTestStatus({ testing: false, message: '', success: null }), EXECUTE_TIMEOUT);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModalState({ ...confirmModalState, isOpen: false });
  };

  const handleAddShortcut = () => {
    const parsedTags = newShortcut
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (parsedTags.length > 0) {
      const uniqueShortcuts = Array.from(new Set([...taggingShortcuts, ...parsedTags])).sort();
      onSettingsChange({ ...appSettings, taggingShortcuts: uniqueShortcuts });
    }
    setNewShortcut('');
  };

  const handleRemoveShortcut = (shortcutToRemove: string) => {
    const uniqueShortcuts = taggingShortcuts.filter((s) => s !== shortcutToRemove);
    onSettingsChange({ ...appSettings, taggingShortcuts: uniqueShortcuts });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddShortcut();
    }
  };

  const handleAddAiTag = () => {
    const parsedTags = newAiTag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (parsedTags.length > 0) {
      const uniqueTags = Array.from(new Set([...customAiTags, ...parsedTags])).sort();
      onSettingsChange({ ...appSettings, customAiTags: uniqueTags });
    }
    setNewAiTag('');
  };

  const handleRemoveAiTag = (tagToRemove: string) => {
    const uniqueTags = customAiTags.filter((t) => t !== tagToRemove);
    onSettingsChange({ ...appSettings, customAiTags: uniqueTags });
  };

  const handleAiTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAiTag();
    }
  };

  const handleKeybindSave = (action: string, combo: string[]) => {
    const newKeybinds = { ...(appSettings?.keybinds || {}), [action]: combo };
    onSettingsChange({ ...appSettings, keybinds: newKeybinds });
  };

  const conflictingKeys = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const userKb = appSettings?.keybinds || {};
    for (const def of KEYBIND_DEFINITIONS) {
      const userCombo = userKb[def.action];
      const effective = userCombo?.length ? userCombo : userCombo === undefined ? def.defaultCombo : null;
      if (!effective) continue;
      const key = effective.join('+');
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(def.action);
    }
    const keys = new Set<string>();
    for (const [, actions] of map) {
      if (actions.size > 1) actions.forEach((k) => keys.add(k));
    }
    return keys;
  }, [appSettings?.keybinds]);

  return (
    <>
      <ConfirmModal {...confirmModalState} onClose={closeConfirmModal} />
      <div className="flex flex-col h-full w-full text-text-primary">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-y-4 mb-8 pt-4">
          <div className="flex items-center shrink-0">
            <Button
              className="mr-4 hover:bg-surface text-text-primary rounded-full"
              onClick={onBack}
              size="icon"
              variant="ghost"
              data-tooltip={t('settings.goToHome')}
            >
              <ArrowLeft />
            </Button>
            <Text variant={TextVariants.display} color={TextColors.accent} className="whitespace-nowrap">
              {t('settings.title')}
            </Text>
          </div>

          <div className="relative flex w-full min-[1200px]:w-112.5 p-2 bg-surface rounded-md">
            {settingCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={clsx(
                  'relative flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  {
                    'text-text-primary hover:bg-surface': activeCategory !== category.id,
                    'text-button-text': activeCategory === category.id,
                  },
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {activeCategory === category.id && (
                  <motion.span
                    layoutId="settings-category-switch-bubble"
                    className="absolute inset-0 z-0 bg-accent"
                    style={{ borderRadius: 6 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center">
                  <category.icon size={16} className="mr-2 shrink-0" />
                  <span className="truncate">{t(category.i18nKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 -mr-2 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeCategory === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-10"
              >
                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.general.section')}
                  </Text>
                  <div className="space-y-8">
                    <SettingItem label={t('settings.general.language')} description={t('settings.general.languageDesc')}>
                      <Dropdown
                        onChange={(value: any) => onSettingsChange({ ...appSettings, language: value as Language })}
                        options={languageOptions}
                        value={appSettings?.language || 'en'}
                        triggerClassName="bg-bg-primary"
                      />
                    </SettingItem>

                    <SettingItem label={t('settings.general.theme')} description={t('settings.general.themeDesc')}>
                      <Dropdown
                        onChange={(value: any) => onSettingsChange({ ...appSettings, theme: value })}
                        options={THEMES.map((theme: ThemeProps) => ({ value: theme.id, label: theme.name }))}
                        value={appSettings?.theme || DEFAULT_THEME_ID}
                        triggerClassName="bg-bg-primary"
                        translate={t}
                      />
                    </SettingItem>

                    <div className="space-y-4">
                      <SettingItem
                        label={t('settings.general.xmpSync')}
                        description={t('settings.general.xmpSyncDesc')}
                      >
                        <Switch
                          checked={appSettings?.enableXmpSync ?? true}
                          id="enable-xmp-sync-toggle"
                          label={t('settings.general.enableXmpSync')}
                          onChange={(checked) => {
                            const newSettings = { ...appSettings, enableXmpSync: checked };
                            if (!checked) {
                              newSettings.createXmpIfMissing = false;
                            }
                            onSettingsChange(newSettings);
                          }}
                        />
                      </SettingItem>

                      <AnimatePresence initial={false}>
                        {(appSettings?.enableXmpSync ?? true) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 border-l-2 border-border-color ml-1">
                              <SettingItem
                                label={t('settings.general.createXmpFiles')}
                                description={t('settings.general.createXmpFilesDesc')}
                              >
                                <Switch
                                  checked={appSettings?.createXmpIfMissing ?? false}
                                  id="create-xmp-missing-toggle"
                                  label={t('settings.general.createXmpIfMissing')}
                                  onChange={(checked) =>
                                    onSettingsChange({ ...appSettings, createXmpIfMissing: checked })
                                  }
                                />
                              </SettingItem>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <SettingItem
                      label={t('settings.general.folderImageCounts')}
                      description={t('settings.general.folderImageCountsDesc')}
                    >
                      <Switch
                        checked={appSettings?.enableFolderImageCounts ?? false}
                        id="folder-image-counts-toggle"
                        label={t('settings.general.showImageCounts')}
                        onChange={(checked) => onSettingsChange({ ...appSettings, enableFolderImageCounts: checked })}
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.general.focusMode')}
                      description={t('settings.general.focusModeDesc')}
                    >
                      <Switch
                        checked={appSettings?.enableFocusMode ?? false}
                        id="focus-mode-toggle"
                        label={t('settings.general.enableFocusMode')}
                        onChange={(checked) => onSettingsChange({ ...appSettings, enableFocusMode: checked })}
                      />
                    </SettingItem>

                    <SettingItem label={t('settings.general.font')} description={t('settings.general.fontDesc')}>
                      <Dropdown
                        onChange={(value: any) => onSettingsChange({ ...appSettings, fontFamily: value })}
                        options={[
                          { value: 'poppins', label: t('settings.general.poppins') },
                          { value: 'system', label: t('settings.general.systemDefault') },
                        ]}
                        value={appSettings?.fontFamily || 'poppins'}
                        triggerClassName="bg-bg-primary"
                      />
                    </SettingItem>

                    {osPlatform === 'linux' && (
                      <SettingItem
                        label={t('settings.general.nativeTitlebar')}
                        description={t('settings.general.nativeTitlebarDesc')}
                      >
                        <Switch
                          checked={appSettings?.decorations ?? false}
                          id="native-titlebar-toggle"
                          label={t('settings.general.enableOsTitlebar')}
                          onChange={(checked) => {
                            onSettingsChange({ ...appSettings, decorations: checked });
                            getCurrentWindow().setDecorations(checked).catch(console.error);
                          }}
                        />
                      </SettingItem>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.adjustmentsVisibility')}
                  </Text>
                  <Text className="mb-4">
                    {t('settings.adjustmentsVisibilityDesc')}
                  </Text>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <Switch
                      label={t('adjustments.chromaticAberration')}
                      checked={appSettings?.adjustmentVisibility?.chromaticAberration ?? false}
                      onChange={(checked) =>
                        onSettingsChange({
                          ...appSettings,
                          adjustmentVisibility: {
                            ...(appSettings?.adjustmentVisibility || adjustmentVisibilityDefaults),
                            chromaticAberration: checked,
                          },
                        })
                      }
                    />
                    <Switch
                      label={t('adjustments.effects.grain')}
                      checked={appSettings?.adjustmentVisibility?.grain ?? true}
                      onChange={(checked) =>
                        onSettingsChange({
                          ...appSettings,
                          adjustmentVisibility: {
                            ...(appSettings?.adjustmentVisibility || adjustmentVisibilityDefaults),
                            grain: checked,
                          },
                        })
                      }
                    />
                    <Switch
                      label={t('adjustments.colorCalibration')}
                      checked={appSettings?.adjustmentVisibility?.colorCalibration ?? true}
                      onChange={(checked) =>
                        onSettingsChange({
                          ...appSettings,
                          adjustmentVisibility: {
                            ...(appSettings?.adjustmentVisibility || adjustmentVisibilityDefaults),
                            colorCalibration: checked,
                          },
                        })
                      }
                    />
                    <Switch
                      label={t('adjustments.details.noiseReduction')}
                      checked={appSettings?.adjustmentVisibility?.noiseReduction ?? true}
                      onChange={(checked) =>
                        onSettingsChange({
                          ...appSettings,
                          adjustmentVisibility: {
                            ...(appSettings?.adjustmentVisibility || adjustmentVisibilityDefaults),
                            noiseReduction: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.myLenses')}
                  </Text>
                  <Text className="mb-6">
                    {t('settings.myLensesDesc')}
                  </Text>

                  <div className="space-y-8">
                    <div className="bg-bg-primary rounded-lg p-4 border border-border-color">
                      <Text variant={TextVariants.heading} className="mb-3">
                        {t('settings.addNewLens')}
                      </Text>
                      <div className="space-y-4">
                        <Dropdown
                          options={lensMakers.map((m) => ({ label: m, value: m }))}
                          value={tempLensMaker}
                          onChange={handleTempMakerChange}
                          placeholder={t('settings.selectManufacturer')}
                        />
                        <Dropdown
                          options={lensModels.map((m) => ({ label: m, value: m }))}
                          value={tempLensModel}
                          onChange={setTempLensModel}
                          placeholder={t('settings.selectLensModel')}
                          disabled={!tempLensMaker}
                        />
                        <Button onClick={handleAddLens} disabled={!tempLensMaker || !tempLensModel} className="w-full">
                          <Plus size={16} className="mr-1" />
                          {t('settings.addToMyLenses')}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Text variant={TextVariants.heading} className="mb-2">
                        {t('settings.savedLenses')}
                      </Text>
                      {(!appSettings?.myLenses || appSettings.myLenses.length === 0) && (
                        <Text className="italic">{t('settings.noLensesAdded')}</Text>
                      )}
                      <div className="divide-y divide-border-color">
                        {(appSettings?.myLenses || []).map((lens: MyLens, index: number) => (
                          <div
                            key={`${lens.maker}-${lens.model}-${index}`}
                            className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-surface rounded-md text-accent">
                                <Bookmark size={16} />
                              </div>
                              <div>
                                <Text color={TextColors.primary} weight={TextWeights.medium}>
                                  {lens.model}
                                </Text>
                                <Text variant={TextVariants.small}>{lens.maker}</Text>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveLens(index)}
                              className="p-2 text-text-secondary hover:text-red-400 hover:bg-bg-primary rounded-md transition-colors"
                              data-tooltip={t('settings.removeLens')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.tagging')}
                  </Text>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <SettingItem
                        description={t('settings.aiTaggingDesc')}
                        label={t('settings.aiTagging')}
                      >
                        <Switch
                          checked={appSettings?.enableAiTagging ?? false}
                          id="ai-tagging-toggle"
                          label={t('settings.automaticAiTagging')}
                          onChange={(checked) => onSettingsChange({ ...appSettings, enableAiTagging: checked })}
                        />
                      </SettingItem>

                      <AnimatePresence>
                        {(appSettings?.enableAiTagging ?? false) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 border-l-2 border-border-color ml-1 space-y-8">
                              <SettingItem
                                label={t('settings.maxAiTags')}
                                description={t('settings.maxAiTagsDesc')}
                              >
                                <Slider
                                  label={t('settings.amount')}
                                  min={1}
                                  max={20}
                                  step={1}
                                  value={appSettings?.aiTagCount ?? 10}
                                  defaultValue={10}
                                  onChange={(e: any) =>
                                    onSettingsChange({ ...appSettings, aiTagCount: parseInt(e.target.value) })
                                  }
                                />
                              </SettingItem>

                              <SettingItem
                                label={t('settings.customAiTagList')}
                                description={t('settings.customAiTagListDesc')}
                              >
                                <div>
                                  <div className="flex flex-wrap gap-2 p-2 bg-bg-primary rounded-md min-h-10 border border-border-color mb-2 items-center">
                                    <AnimatePresence>
                                      {customAiTags.length > 0 ? (
                                        customAiTags.map((tag: string) => (
                                          <motion.div
                                            key={tag}
                                            layout
                                            variants={shortcutTagVariants}
                                            initial={false}
                                            animate="visible"
                                            exit="exit"
                                            onClick={() => handleRemoveAiTag(tag)}
                                            data-tooltip={`Remove tag "${tag}"`}
                                            className="flex items-center gap-1 bg-surface px-2 py-1 rounded-sm group cursor-pointer"
                                          >
                                            <Text variant={TextVariants.label} color={TextColors.primary}>
                                              {tag}
                                            </Text>
                                            <span className="rounded-full group-hover:bg-black/20 p-0.5 transition-colors">
                                              <X size={14} />
                                            </span>
                                          </motion.div>
                                        ))
                                      ) : (
                                        <motion.span
                                          key="no-ai-tags-placeholder"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                        >
                                          <Text className="px-1 select-none italic">
                                            {t('settings.noCustomAiTags')}
                                          </Text>
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <Input
                                        type="text"
                                        value={newAiTag}
                                        onChange={(e) => setNewAiTag(e.target.value)}
                                        onKeyDown={handleAiTagInputKeyDown}
                                        placeholder={t('settings.addCustomAiTagsPlaceholder')}
                                        className="pr-10"
                                        bgClassName="bg-bg-primary"
                                      />
                                      <button
                                        onClick={handleAddAiTag}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface"
                                        data-tooltip={t('settings.addAiTag')}
                                      >
                                        <Plus size={18} />
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => onSettingsChange({ ...appSettings, customAiTags: [] })}
                                      disabled={customAiTags.length === 0}
                                      className="p-2 text-text-secondary hover:text-red-400 hover:bg-surface rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary disabled:hover:bg-transparent"
                                      data-tooltip={t('settings.clearAiTagList')}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                              </SettingItem>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <SettingItem
                      label={t('settings.taggingShortcuts')}
                      description={t('settings.taggingShortcutsDesc')}
                    >
                      <div>
                        <div className="flex flex-wrap gap-2 p-2 bg-bg-primary rounded-md min-h-10 border border-border-color mb-2 items-center">
                          <AnimatePresence>
                            {taggingShortcuts.length > 0 ? (
                              taggingShortcuts.map((shortcut: string) => (
                                <motion.div
                                  key={shortcut}
                                  layout
                                  variants={shortcutTagVariants}
                                  initial={false}
                                  animate="visible"
                                  exit="exit"
                                  onClick={() => handleRemoveShortcut(shortcut)}
                                  data-tooltip={`Remove shortcut "${shortcut}"`}
                                  className="flex items-center gap-1 bg-surface px-2 py-1 rounded-sm group cursor-pointer"
                                >
                                  <Text variant={TextVariants.label} color={TextColors.primary}>
                                    {shortcut}
                                  </Text>
                                  <span className="rounded-full group-hover:bg-black/20 p-0.5 transition-colors">
                                    <X size={14} />
                                  </span>
                                </motion.div>
                              ))
                            ) : (
                              <motion.span
                                key="no-shortcuts-placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-sm text-text-secondary italic px-1 select-none"
                              >
                                {t('settings.noShortcutsAdded')}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              type="text"
                              value={newShortcut}
                              onChange={(e) => setNewShortcut(e.target.value)}
                              onKeyDown={handleInputKeyDown}
                              placeholder={t('settings.addShortcutsPlaceholder')}
                              className="pr-10"
                              bgClassName="bg-bg-primary"
                            />
                            <button
                              onClick={handleAddShortcut}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface"
                              data-tooltip={t('settings.addShortcut')}
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                          <button
                            onClick={() => onSettingsChange({ ...appSettings, taggingShortcuts: [] })}
                            disabled={taggingShortcuts.length === 0}
                            className="p-2 text-text-secondary hover:text-red-400 hover:bg-surface rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary disabled:hover:bg-transparent"
                            data-tooltip={t('settings.clearShortcutsTagList')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </SettingItem>

                    <div className="pt-8 border-t border-border-color">
                      <div className="space-y-8">
                        <DataActionItem
                          buttonAction={handleClearAiTags}
                          buttonText={t('common.clear')}
                          description={t('settings.clearAiTagsDesc')}
                          disabled={effectiveRootPaths.length === 0}
                          icon={<Trash2 size={16} className="mr-2" />}
                          isProcessing={isClearingAiTags}
                          message={aiTagsClearMessage}
                          title={t('settings.clearAiTags')}
                        />
                        <DataActionItem
                          buttonAction={handleClearTags}
                          buttonText={t('common.clear')}
                          description={t('settings.clearAllTagsDesc')}
                          disabled={effectiveRootPaths.length === 0}
                          icon={<Trash2 size={16} className="mr-2" />}
                          isProcessing={isClearingTags}
                          message={tagsClearMessage}
                          title={t('settings.clearAllTags')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-6">
                    {t('settings.specialThanks')}
                  </Text>
                  <Text className="mb-4">
                    {t('settings.specialThanksDesc')}
                  </Text>
                  <Text as="ul" className="space-y-3 list-disc ml-5 pl-1">
                    <li>
                      <a
                        href="https://github.com/dnglab/dnglab/tree/main/rawler"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        rawler
                      </a>
                      : For the excellent Rust crate that provides the foundation for RAW file processing in this
                      project.
                    </li>
                    <li>
                      <a
                        href="https://lensfun.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        lensfun
                      </a>
                      : For its invaluable open-source library and comprehensive database for automatic lens correction.
                    </li>
                    <li>
                      <a
                        href="https://github.com/marcinz606/NegPy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        NegPy
                      </a>
                      : For the inspiration behind the negative conversion logic.
                    </li>
                    <li>
                      <a
                        href="https://github.com/advimman/lama"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        LaMa
                      </a>
                      : For the powerful & simple image inpainting model, which enables content-aware fill and object
                      removal.
                    </li>
                    <li>
                      <a
                        href="https://github.com/facebookresearch/sam2"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        SAM 2
                      </a>
                      : For providing the foundation model used for the AI subject detection capabilities.
                    </li>
                    <li>
                      <a
                        href="https://github.com/xuebinqin/U-2-Net"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        U-2-Net
                      </a>
                      : For providing the robust architecture used for the AI sky and foreground detection capabilities.
                    </li>
                    <li>
                      <a
                        href="https://github.com/DepthAnything/Depth-Anything-V2"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        Depth Anything V2
                      </a>
                      : For the powerful monocular depth estimation model that enables the AI depth masking
                      capabilities.
                    </li>
                    <li>
                      <a
                        href="https://github.com/trougnouf/nind-denoise"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        nind-denoise
                      </a>
                      : For providing AI models that power the AI noise reduction capabilities in RapidRAW.
                    </li>
                    <li>
                      <a
                        href="https://github.com/darktable-org/darktable"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        darktable & co.
                      </a>
                      : For some reference implementations that guided parts of this work.
                    </li>
                    <li>
                      <span className="font-semibold text-accent">You</span>: For using and supporting RapidRAW. Your
                      interest keeps this project alive and evolving.
                    </li>
                  </Text>
                </div>
              </motion.div>
            )}
            {activeCategory === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-10"
              >
                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.processing.engine')}
                  </Text>
                  <div className="space-y-8">
                    <div>
                      <Text variant={TextVariants.heading} className="mb-2">
                        {t('settings.processing.previewRenderingStrategy')}
                      </Text>
                      <PreviewModeSwitch
                        mode={appSettings?.enableZoomHifi ? 'dynamic' : 'static'}
                        onModeChange={handlePreviewModeChange}
                      />

                      <div className="mt-3">
                        <AnimatePresence mode="wait">
                          {!(appSettings?.enableZoomHifi ?? true) ? (
                            <motion.div
                              key="static-preview"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Text variant={TextVariants.small} className="mb-4">
                                {t('settings.processing.staticPreviewDesc')}
                              </Text>
                              <div className="pl-4 border-l-2 border-border-color ml-1">
                                <SettingItem
                                  description={t('settings.processing.previewResolutionDesc')}
                                  label={t('settings.processing.previewResolution')}
                                >
                                  <Dropdown
                                    onChange={(value: any) =>
                                      handleProcessingSettingChange('editorPreviewResolution', value)
                                    }
                                    options={resolutions}
                                    value={processingSettings.editorPreviewResolution}
                                    triggerClassName="bg-bg-primary"
                                  />
                                </SettingItem>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="dynamic-preview"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Text variant={TextVariants.small} className="mb-4">
                                {t('settings.processing.dynamicPreviewDesc')}
                              </Text>
                              <div className="pl-4 border-l-2 border-border-color ml-1 space-y-3">
                                <SettingItem
                                  description={t('settings.processing.staticPreviewResolutionDesc')}
                                  label={t('settings.processing.staticPreviewResolution')}
                                >
                                  <Dropdown
                                    onChange={(value: any) =>
                                      handleProcessingSettingChange('editorPreviewResolution', value)
                                    }
                                    options={resolutions}
                                    value={processingSettings.editorPreviewResolution}
                                    triggerClassName="bg-bg-primary"
                                  />
                                </SettingItem>

                                <SettingItem
                                  label={t('settings.processing.renderResolutionScale')}
                                  description={t('settings.processing.renderResolutionScaleDesc')}
                                >
                                  <Dropdown
                                    onChange={(value: any) =>
                                      handleProcessingSettingChange('highResZoomMultiplier', value)
                                    }
                                    options={zoomMultiplierOptions}
                                    value={processingSettings.highResZoomMultiplier}
                                    triggerClassName="bg-bg-primary"
                                    translate={t}
                                  />
                                </SettingItem>

                                <SettingItem
                                  label={t('settings.processing.highDpiRendering')}
                                  description={
                                    dpr > 1
                                      ? t('settings.processing.highDpiDesc', { dpr })
                                      : t('settings.processing.standardDpiDesc')
                                  }
                                >
                                  <Switch
                                    checked={processingSettings.useFullDpiRendering}
                                    disabled={dpr <= 1}
                                    id="full-dpi-rendering-toggle"
                                    label={t('settings.processing.renderAtNativeDpi')}
                                    onChange={(checked) =>
                                      handleProcessingSettingChange('useFullDpiRendering', checked)
                                    }
                                  />
                                </SettingItem>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SettingItem
                        label={t('settings.processing.liveInteractivePreviews')}
                        description={t('settings.processing.liveInteractivePreviewsDesc')}
                      >
                        <Switch
                          checked={appSettings?.enableLivePreviews ?? true}
                          id="live-previews-toggle"
                          label={t('settings.processing.enableLivePreviews')}
                          onChange={(checked) => {
                            setHasInteractedWithLivePreview(true);
                            onSettingsChange({ ...appSettings, enableLivePreviews: checked });
                          }}
                        />
                      </SettingItem>

                      <AnimatePresence>
                        {(appSettings?.enableLivePreviews ?? true) && (
                          <motion.div
                            initial={hasInteractedWithLivePreview ? { height: 0, opacity: 0 } : false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                          >
                            <div className="pl-4 border-l-2 border-border-color ml-1">
                              <SettingItem
                                label={t('settings.processing.livePreviewQuality')}
                                description={t('settings.processing.livePreviewQualityDesc')}
                              >
                                <Dropdown
                                  onChange={(value: any) =>
                                    onSettingsChange({ ...appSettings, livePreviewQuality: value })
                                  }
                                  options={livePreviewQualityOptions.map(opt => ({
                                    ...opt,
                                    label: t(_livePreviewQualityOptionKeys[opt.value] || opt.label)
                                  }))}
                                  value={appSettings?.livePreviewQuality || 'high'}
                                  triggerClassName="bg-bg-primary"
                                />
                              </SettingItem>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <SettingItem
                      description={t('settings.processing.thumbnailResolutionDesc2')}
                      label={t('settings.processing.thumbnailResolution')}
                    >
                      <Dropdown
                        onChange={(value: any) => handleProcessingSettingChange('thumbnailResolution', value)}
                        options={thumbnailResolutions}
                        value={processingSettings.thumbnailResolution}
                        triggerClassName="bg-bg-primary"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.thumbnailWorkerThreads')}
                      description={t('settings.processing.thumbnailWorkerThreadsDesc')}
                    >
                      <Slider
                        label={t('settings.processing.threads')}
                        min={2}
                        max={10}
                        step={1}
                        value={processingSettings.thumbnailWorkerThreads}
                        defaultValue={4}
                        onChange={(e: any) =>
                          handleProcessingSettingChange('thumbnailWorkerThreads', parseInt(e.target.value))
                        }
                        fillOrigin="min"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.decodedImageCache')}
                      description={t('settings.processing.decodedImageCacheDesc')}
                    >
                      <Slider
                        label={t('settings.processing.images')}
                        min={2}
                        max={10}
                        step={1}
                        value={processingSettings.imageCacheSize}
                        defaultValue={5}
                        onChange={(e: any) => handleProcessingSettingChange('imageCacheSize', parseInt(e.target.value))}
                        fillOrigin="min"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.wgpuDirectRendering')}
                      description={
                        osPlatform === 'linux'
                          ? t('settings.processing.wgpuLinuxDesc')
                          : osPlatform === 'android'
                            ? t('settings.processing.wgpuAndroidDesc')
                            : t('settings.processing.wgpuRecommendedDesc')
                      }
                    >
                      <Switch
                        checked={processingSettings.useWgpuRenderer}
                        disabled={osPlatform === 'linux' || osPlatform === 'android'}
                        id="wgpu-renderer-toggle"
                        label={t('settings.processing.enableDirectWgpuRender')}
                        onChange={(checked) => handleProcessingSettingChange('useWgpuRenderer', checked)}
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.processingBackend')}
                      description={t('settings.processing.processingBackendDesc')}
                    >
                      <Dropdown
                        onChange={(value: any) => handleProcessingSettingChange('processingBackend', value)}
                        options={filteredBackendOptions}
                        value={
                          filteredBackendOptions.some((option) => option.value === processingSettings.processingBackend)
                            ? processingSettings.processingBackend
                            : 'auto'
                        }
                        triggerClassName="bg-bg-primary"
                      />
                    </SettingItem>

                    {osPlatform !== 'macos' && osPlatform !== 'windows' && (
                      <SettingItem
                        label={t('settings.processing.linuxCompatibilityMode')}
                        description={t('settings.processing.linuxCompatibilityModeDesc')}
                      >
                        <Switch
                          checked={processingSettings.linuxGpuOptimization}
                          id="gpu-compat-toggle"
                          label={t('settings.processing.enableCompatibilityMode')}
                          onChange={(checked) => handleProcessingSettingChange('linuxGpuOptimization', checked)}
                        />
                      </SettingItem>
                    )}

                    {restartRequired && (
                      <>
                        <Text
                          as="div"
                          color={TextColors.info}
                          className="p-3 bg-blue-900/10 border border-blue-500/50 rounded-lg flex items-center gap-3"
                        >
                          <Info size={18} />
                          <p>{t('settings.processing.restartRequiredDesc')}</p>
                        </Text>
                        <div className="flex justify-end">
                          <Button onClick={handleSaveAndRelaunch}>{t('settings.processing.saveAndRelaunch')}</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.processing.imagePreprocessing')}
                  </Text>
                  <div className="space-y-8">
                    <SettingItem
                      label={t('settings.processing.rawHighlightRecovery')}
                      description={t('settings.processing.rawHighlightRecoveryDesc')}
                    >
                      <Slider
                        label={t('settings.amount')}
                        min={1}
                        max={10}
                        step={0.1}
                        value={processingSettings.rawHighlightCompression}
                        defaultValue={2.5}
                        onChange={(e: any) =>
                          handleProcessingSettingChange('rawHighlightCompression', parseFloat(e.target.value))
                        }
                        fillOrigin="min"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.baseColorNoiseReduction')}
                      description={t('settings.processing.baseColorNoiseReductionDesc')}
                    >
                      <Slider
                        label={t('settings.amount')}
                        min={0}
                        max={1.0}
                        step={0.05}
                        value={processingSettings.rawPreprocessingColorNr}
                        defaultValue={0.5}
                        onChange={(e: any) =>
                          handleProcessingSettingChange('rawPreprocessingColorNr', parseFloat(e.target.value))
                        }
                        fillOrigin="min"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.preSharpening')}
                      description={t('settings.processing.preSharpeningDesc')}
                    >
                      <Slider
                        label={t('settings.amount')}
                        min={0}
                        max={1.0}
                        step={0.05}
                        value={processingSettings.rawPreprocessingSharpening}
                        defaultValue={0.35}
                        onChange={(e: any) =>
                          handleProcessingSettingChange('rawPreprocessingSharpening', parseFloat(e.target.value))
                        }
                        fillOrigin="min"
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.applyPreprocessingToNonRaws')}
                      description={t('settings.processing.applyPreprocessingToNonRawsDesc')}
                    >
                      <Switch
                        checked={processingSettings.applyPreprocessingToNonRaws}
                        id="preprocessing-non-raws-toggle"
                        label={t('settings.processing.enableForNonRaws')}
                        onChange={(checked) => handleProcessingSettingChange('applyPreprocessingToNonRaws', checked)}
                      />
                    </SettingItem>

                    <SettingItem
                      label={t('settings.processing.linearRawProcessing')}
                      description={t('settings.processing.linearRawProcessingDesc')}
                    >
                      <Dropdown
                        onChange={(value: any) => onSettingsChange({ ...appSettings, linearRawMode: value })}
                        options={linearRawOptions}
                        value={appSettings?.linearRawMode || 'auto'}
                        triggerClassName="bg-bg-primary"
                        translate={t}
                      />
                    </SettingItem>

                    <div className="space-y-4">
                      <SettingItem
                        label={t('settings.processing.globalTonemapperOverride')}
                        description={t('settings.processing.globalTonemapperOverrideDesc')}
                      >
                        <Switch
                          checked={appSettings?.tonemapperOverrideEnabled ?? false}
                          id="tonemapper-override-toggle"
                          label={t('settings.processing.enableTonemapperOverride')}
                          onChange={(checked) =>
                            onSettingsChange({ ...appSettings, tonemapperOverrideEnabled: checked })
                          }
                        />
                      </SettingItem>

                      <AnimatePresence>
                        {(appSettings?.tonemapperOverrideEnabled ?? false) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                          >
                            <div className="pl-4 border-l-2 border-border-color ml-1 space-y-3">
                              <SettingItem
                                label={t('settings.processing.defaultRawTonemapper')}
                                description={t('settings.processing.defaultRawTonemapperDesc')}
                              >
                                <Dropdown
                                  onChange={(value: any) =>
                                    onSettingsChange({ ...appSettings, defaultRawTonemapper: value })
                                  }
                                  options={tonemapperOptions}
                                  value={appSettings?.defaultRawTonemapper || 'agx'}
                                  triggerClassName="bg-bg-primary"
                                  translate={t}
                                />
                              </SettingItem>

                              <SettingItem
                                label={t('settings.processing.defaultNonRawTonemapper')}
                                description={t('settings.processing.defaultNonRawTonemapperDesc')}
                              >
                                <Dropdown
                                  onChange={(value: any) =>
                                    onSettingsChange({ ...appSettings, defaultNonRawTonemapper: value })
                                  }
                                  options={tonemapperOptions}
                                  value={appSettings?.defaultNonRawTonemapper || 'basic'}
                                  triggerClassName="bg-bg-primary"
                                  translate={t}
                                />
                              </SettingItem>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.generativeAi')}
                  </Text>
                  <Text className="mb-4">
                    {t('settings.generativeAiDesc')}
                  </Text>

                  <AiProviderSwitch selectedProvider={aiProvider} onProviderChange={handleProviderChange} />

                  <div className="mt-8">
                    <AnimatePresence mode="wait">
                      {aiProvider === 'cpu' && (
                        <motion.div
                          key="cpu"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Text variant={TextVariants.heading}>{t('settings.builtinAiCpu')}</Text>
                          <Text className="mt-1">
                            {t('settings.builtinAiCpuDesc')}
                          </Text>
                          <Text as="ul" className="mt-3 space-y-1 list-disc list-inside">
                            <li>{t('aiMasking')}</li>
                            <li>{t('automaticImageTagging')}</li>
                            <li>{t('simpleCpuGenerativeReplace')}</li>
                          </Text>
                        </motion.div>
                      )}

                      {aiProvider === 'ai-connector' && (
                        <motion.div
                          key="ai-connector"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="space-y-8">
                            <div>
                              <Text variant={TextVariants.heading}>{t('settings.selfHostedConnector')}</Text>
                              <Text className="mt-1">
                                {t('settings.selfHostedConnectorDesc')}
                              </Text>
                              <Text as="ul" className="mt-3 space-y-1 list-disc list-inside">
                                <li>{t('selfHostedConnectorFeatures.useOwnComfyUi')}</li>
                                <li>{t('selfHostedConnectorFeatures.costFreeEdits')}</li>
                                <li>{t('selfHostedConnectorFeatures.customWorkflow')}</li>
                              </Text>
                            </div>
                            <SettingItem
                              label={t('settings.aiConnectorAddress')}
                              description={t('settings.aiConnectorAddressDesc')}
                            >
                              <div className="flex items-center gap-2">
                                <Input
                                  className="grow"
                                  id="ai-connector-address"
                                  onBlur={() =>
                                    onSettingsChange({ ...appSettings, aiConnectorAddress: aiConnectorAddress })
                                  }
                                  onChange={(e: any) => setAiConnectorAddress(e.target.value)}
                                  onKeyDown={(e: any) => e.stopPropagation()}
                                  placeholder={t('settings.aiConnectorAddressPlaceholder')}
                                  type="text"
                                  value={aiConnectorAddress}
                                  bgClassName="bg-bg-primary"
                                />
                                <Button
                                  className="w-32"
                                  disabled={testStatus.testing || !aiConnectorAddress}
                                  onClick={handleTestConnection}
                                >
                                  {testStatus.testing ? t('common.processing') : t('settings.test')}
                                </Button>
                              </div>
                              {testStatus.message && (
                                <Text
                                  color={testStatus.success ? TextColors.success : TextColors.error}
                                  className="mt-2 flex items-center gap-2"
                                >
                                  {testStatus.success === true && <Wifi size={16} />}
                                  {testStatus.success === false && <WifiOff size={16} />}
                                  {testStatus.message}
                                </Text>
                              )}
                            </SettingItem>
                          </div>
                        </motion.div>
                      )}

                      {aiProvider === 'cloud' && (
                        <motion.div
                          key="cloud"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Text variant={TextVariants.heading}>{t('settings.cloudService')}</Text>
                          <Text className="mt-1">
                            {t('settings.cloudServiceDesc')}
                          </Text>
                          <Text as="ul" className="mt-3 space-y-1 list-disc list-inside">
                            <li>Maximum convenience, no setup</li>
                            <li>Same results as self-hosting</li>
                            <li>No powerful hardware required</li>
                          </Text>

                          <div className="mt-8">
                            <Show when="signed-in">
                              <div className="p-6 bg-bg-primary rounded-xl border border-border-color shadow-inner">
                                <CloudDashboard />
                              </div>
                            </Show>
                            <Show when="signed-out">
                              <div className="w-full max-w-md">
                                <SignIn
                                  routing="hash"
                                  fallbackRedirectUrl="/"
                                  forceRedirectUrl="/"
                                  appearance={{
                                    variables: {
                                      colorBackground: 'transparent',
                                      colorInput: 'transparent',
                                      colorForeground: 'inherit',
                                      colorInputForeground: 'inherit',
                                      colorTextOnPrimaryBackground: 'inherit',
                                      colorPrimaryForeground: 'inherit',
                                      colorBorder: 'transparent',
                                      colorShadow: 'none',
                                      colorNeutral: 'inherit',
                                    },
                                    elements: {
                                      rootBox: '',

                                      cardBox: '!shadow-none !m-0 !p-0 !rounded-none',

                                      card: '!bg-transparent !border-none !shadow-none !py-0 !px-1 !rounded-none',

                                      header: '!hidden',

                                      formFieldLabel: '!text-base !font-semibold !text-text-primary !block !mb-2',

                                      formFieldAction:
                                        '!text-text-secondary hover:!text-text-primary !transition-colors !no-underline hover:!underline',

                                      formFieldInput:
                                        '!bg-bg-primary !border !border-border-color !text-text-primary focus:!border-accent focus:!ring-1 focus:!ring-accent !rounded-md !px-3 !py-2',

                                      formButtonPrimary:
                                        '!bg-accent !text-button-text hover:!bg-accent/90 !shadow-none !transition-colors !rounded-md !mt-4 !py-2',

                                      footer:
                                        '!bg-transparent !p-0 !mt-4 opacity-50 hover:opacity-100 transition-opacity',
                                      footerAction: '!hidden',

                                      identityPreview: '!bg-bg-primary !border !border-border-color !rounded-md !mb-4',
                                      identityPreviewText: '!text-text-primary !font-medium',
                                      identityPreviewEditButtonIcon:
                                        '!text-text-secondary hover:!text-text-primary !transition-colors',
                                    },
                                  }}
                                />
                                <div className="mt-6">
                                  <Text variant={TextVariants.small}>
                                    Don't have an account?{' '}
                                    <button
                                      onClick={() => open('https://www.getrapidraw.com/dashboard')}
                                      className="text-accent hover:underline focus:outline-none"
                                    >
                                      {t('settings.signUpWebsite')}
                                    </button>
                                  </Text>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.dataManagement')}
                  </Text>
                  <div className="space-y-8">
                    <DataActionItem
                      buttonAction={handleClearSidecars}
                      buttonText={t('common.clear')}
                      description={
                        <Text as="span" variant={TextVariants.small}>
                          This will delete all{' '}
                          <code className="bg-bg-primary px-1 rounded-sm text-text-primary">.rrdata</code> files
                          (containing your edits) within your root folders:
                          <span className="block font-mono bg-bg-primary p-2 rounded-sm mt-2 break-all border border-border-color whitespace-pre-wrap">
                            {effectiveRootPaths.length > 0 ? effectiveRootPaths.join('\n') : 'No folders selected'}
                          </span>
                        </Text>
                      }
                      disabled={effectiveRootPaths.length === 0}
                      icon={<Trash2 size={16} className="mr-2" />}
                      isProcessing={isClearing}
                      message={clearMessage}
                      title={t('settings.clearAllSidecarFiles')}
                    />

                    <DataActionItem
                      buttonAction={handleClearCache}
                      buttonText={t('common.clear')}
                      description={t('settings.clearThumbnailCacheDesc')}
                      icon={<Trash2 size={16} className="mr-2" />}
                      isProcessing={isClearingCache}
                      message={cacheClearMessage}
                      title={t('settings.clearThumbnailCache')}
                    />

                    <DataActionItem
                      buttonAction={async () => {
                        if (logPath && !logPath.startsWith('Could not')) {
                          await invoke(Invokes.ShowInFinder, { path: logPath });
                        }
                      }}
                      buttonText={t('common.open')}
                      description={
                        <Text as="span" variant={TextVariants.small}>
                          {t('settings.viewApplicationLogsDesc')}
                          <span className="block font-mono bg-bg-primary p-2 rounded-sm mt-2 break-all border border-border-color">
                            {logPath || t('common.loading')}
                          </span>
                        </Text>
                      }
                      disabled={!logPath || logPath.startsWith('Could not')}
                      icon={<ExternalLinkIcon size={16} className="mr-2" />}
                      isProcessing={false}
                      message=""
                      title={t('settings.viewApplicationLogs')}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeCategory === 'shortcuts' && (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-10"
              >
                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.mouseControls')}
                  </Text>
                  <div className="space-y-8">
                    <div>
                      <Text variant={TextVariants.heading} className="mb-2">
                        {t('settings.inputDeviceOptimization')}
                      </Text>
                      <Text variant={TextVariants.small} className="mb-4">
                        {t('settings.inputDeviceOptimizationDesc')}
                      </Text>
                      <CanvasInputModeSwitch
                        mode={(appSettings?.canvasInputMode as 'mouse' | 'trackpad') || 'mouse'}
                        onModeChange={(value) => onSettingsChange({ ...appSettings, canvasInputMode: value })}
                      />
                    </div>

                    <SettingItem
                      label={t('settings.zoomSpeedMultiplier')}
                      description={t('settings.zoomSpeedMultiplierDesc')}
                    >
                      <Slider
                        label={t('settings.speed')}
                        min={0.1}
                        max={3.0}
                        step={0.1}
                        value={appSettings?.zoomSpeedMultiplier ?? 1.0}
                        defaultValue={1.0}
                        onChange={(e: any) =>
                          onSettingsChange({ ...appSettings, zoomSpeedMultiplier: parseFloat(e.target.value) })
                        }
                        fillOrigin="min"
                      />
                    </SettingItem>
                  </div>
                </div>

                <div className="p-6 bg-surface rounded-xl shadow-md">
                  <Text variant={TextVariants.title} color={TextColors.accent} className="mb-8">
                    {t('settings.keyboardControls')}
                  </Text>
                  <div className="space-y-8">
                    {' '}
                    {KEYBIND_SECTIONS.map((section) => {
                      const sectionDefs = KEYBIND_DEFINITIONS.filter((d) => d.section === section.id);
                      const userKb = appSettings?.keybinds || {};
                      return (
                        <div key={section.id}>
                          <Text variant={TextVariants.heading}>{t(section.label)}</Text>
                          <div className="divide-y divide-border-color">
                            {sectionDefs.map((def) => (
                              <KeybindRow
                                key={def.action}
                                def={def}
                                currentCombo={userKb[def.action]}
                                osPlatform={osPlatform}
                                onSave={handleKeybindSave}
                                recordingAction={recordingAction}
                                onStartRecording={setRecordingAction}
                                isConflicting={conflictingKeys.has(def.action)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end mt-6">
                      <Button variant="ghost" onClick={() => onSettingsChange({ ...appSettings, keybinds: {} })}>
                        {t('settings.resetAllToDefaults')}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
