"use client";

import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  BookOpen,
  Check,
  Computer,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  History,
  Home,
  Keyboard,
  Library,
  LoaderCircle,
  Moon,
  Palette,
  PencilLine,
  RefreshCw,
  Settings,
  Shield,
  Sun,
  type LucideIcon,
} from "@/app/icons/material-symbols";
import {
  type KeyboardEvent,
  type CSSProperties,
  type RefObject,
  useRef,
  useState,
} from "react";
import type {
  CodeViewLineDirection,
  CodeViewPreferences,
} from "../editor/code-view-preferences";
import {
  ACCENT_OPTIONS,
  type AccentId,
  type AppearancePreferences,
  type MotionPreference,
  type ThemePreference,
} from "../settings/appearance-preferences";
import type {
  ReadingLineSpacing,
  ReadingPreferences,
  ReadingTextSize,
  ReadingTextWidth,
} from "../settings/reading-preferences";
import type {
  FileLibraryPreferences,
  FileOpenMode,
  LibraryFileVisibility,
} from "../settings/file-library-preferences";
import type {
  GeneralPreferences,
  StartupView,
} from "../settings/general-preferences";
import type {
  ExternalImagePolicy,
  PrivacyPreferences,
} from "../settings/privacy-preferences";
import type { AiPreferences } from "../settings/ai-preferences";
import {
  evaluateDriveQuota,
  type BackupPreferences,
  type BackupProviderId,
  type BackupStatus,
  type CloudBackupSummary,
  type CloudRestoreResult,
} from "../backup/policy";
import type { CommandEnvironment } from "../keyboard/command-registry";
import { AccessibleModal } from "./accessible-modal";
import { AiSpeechSettings } from "./ai-speech-settings";
import {
  SoftwareUpdateStatusCard,
  type SoftwareUpdateActions,
} from "./software-update-ui";
import { SettingsShortcutSections } from "./settings-shortcut-sections";
import type { SoftwareUpdateState } from "../software-update/types";

export type SettingsCategoryId =
  | "general"
  | "ai"
  | "appearance"
  | "reading"
  | "editing"
  | "files"
  | "privacy"
  | "shortcuts";

type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type SettingsLibraryFolder = {
  rootId: string;
  rootName: string;
  rootPath: string;
  fileCount: number;
  sessionOnly?: boolean;
};

const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: "general",
    label: "عمومی",
    description: "رفتار شروع برنامه و شیوهٔ بازگشت به کار را تنظیم کنید.",
    icon: Home,
  },
  {
    id: "appearance",
    label: "ظاهر",
    description: "حالت نمایش و رنگ رابط را مطابق محیط و سلیقهٔ خود انتخاب کنید.",
    icon: Palette,
  },
  {
    id: "ai",
    label: "هوش مصنوعی و گفتار",
    description: "اتصال ChatGPT و پردازش گفتار محلی را مدیریت کنید.",
    icon: BrainCircuit,
  },
  {
    id: "reading",
    label: "مطالعه",
    description: "نمایش متن را برای مطالعهٔ طولانی، راحت و شخصی کنید.",
    icon: BookOpen,
  },
  {
    id: "editing",
    label: "ویرایش",
    description: "تنظیمات نوشتن و متن خام",
    icon: PencilLine,
  },
  {
    id: "files",
    label: "فایل‌ها و کتابخانه",
    description: "فضای ابری، دامنهٔ بکاپ و نسخه‌ها بدون دکمهٔ ذخیره اعمال می‌شوند.",
    icon: Library,
  },
  {
    id: "privacy",
    label: "حریم خصوصی و داده‌ها",
    description:
      "کنترل کنید محتوای بیرونی چگونه بارگیری شود و داده‌های محلی چگونه مدیریت شوند.",
    icon: Shield,
  },
  {
    id: "shortcuts",
    label: "میان‌برها",
    description:
      "همهٔ میان‌برهای فعال را جست‌وجو کنید و کلیدهای مناسب دستگاه‌تان را ببینید.",
    icon: Keyboard,
  },
] as const;

const BACKUP_PROVIDERS: ReadonlyArray<{
  id: BackupProviderId;
  name: string;
  description: string;
  logo: string;
}> = [
  {
    id: "google-drive",
    name: "Google Drive",
    description: "فضای حساب Google",
    logo: "/brands/google/google-drive-2026.svg",
  },
  {
    id: "proton-drive",
    name: "Proton Drive",
    description: "رمزنگاری سرتاسری",
    logo: "/brands/proton/proton-drive.svg",
  },
];

function formatStorageBytes(value: number) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toLocaleString("fa-IR", {
    maximumFractionDigits: unit > 2 ? 1 : 0,
  })} ${units[unit]}`;
}

function formatBackupDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "زمان نامشخص";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function SettingsHeading({
  category,
  titleRef,
}: {
  category: SettingsCategory;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="shortcut-settings-heading">
      <div className="shortcut-settings-heading-copy">
        <h2 id="shortcut-settings-title" ref={titleRef} tabIndex={-1}>
          {category.id === "editing"
            ? "ویرایش و نمای کد"
            : category.id === "shortcuts"
              ? "میان‌برهای صفحه‌کلید"
              : category.id === "files"
                ? "پشتیبان‌گیری ابری"
              : category.label}
        </h2>
        <p id="shortcut-settings-description">{category.description}</p>
      </div>
      {category.id !== "editing" && category.id !== "shortcuts" && (
        <p className="shortcut-settings-autosave">
          ذخیرهٔ خودکار روی این دستگاه
        </p>
      )}
    </div>
  );
}

export function ShortcutSettingsDialog({
  open,
  isTopLayer,
  environment,
  codeViewPreferences,
  onCodeViewPreferencesChange,
  appearancePreferences,
  onAppearancePreferencesChange,
  generalPreferences,
  onGeneralPreferencesChange,
  readingPreferences,
  onReadingPreferencesChange,
  fileLibraryPreferences,
  onFileLibraryPreferencesChange,
  backupStatus,
  onBackupPreferencesChange,
  onBackupProviderChange,
  onConnectBackupProvider,
  onDisconnectBackupProvider,
  onListCloudBackups,
  onRestoreCloudBackups,
  onRevealCloudRestore,
  privacyPreferences,
  onPrivacyPreferencesChange,
  aiPreferences,
  onAiPreferencesChange,
  onOpenExternal,
  libraryFolders,
  libraryFileCount,
  onConnectLibrary,
  onRefreshLibrary,
  onChooseDefaultSaveFolder,
  onDisconnectLibrary,
  onClearRecentFiles,
  onResetSettings,
  onReplayOnboarding,
  softwareUpdateState,
  softwareUpdateActions,
  onClose,
  returnFocusRef,
  initialCategory = "general",
}: {
  open: boolean;
  isTopLayer: boolean;
  environment: CommandEnvironment;
  codeViewPreferences: CodeViewPreferences;
  onCodeViewPreferencesChange: (preferences: CodeViewPreferences) => void;
  appearancePreferences: AppearancePreferences;
  onAppearancePreferencesChange: (preferences: AppearancePreferences) => void;
  generalPreferences: GeneralPreferences;
  onGeneralPreferencesChange: (preferences: GeneralPreferences) => void;
  readingPreferences: ReadingPreferences;
  onReadingPreferencesChange: (preferences: ReadingPreferences) => void;
  fileLibraryPreferences: FileLibraryPreferences;
  onFileLibraryPreferencesChange: (preferences: FileLibraryPreferences) => void;
  backupStatus: BackupStatus;
  onBackupPreferencesChange: (preferences: BackupPreferences) => Promise<void>;
  onBackupProviderChange: (providerId: BackupProviderId) => Promise<BackupStatus | void>;
  onConnectBackupProvider: (providerId: BackupProviderId) => Promise<BackupStatus | void>;
  onDisconnectBackupProvider: (providerId: BackupProviderId) => Promise<void>;
  onListCloudBackups: () => Promise<CloudBackupSummary[]>;
  onRestoreCloudBackups: (documentIds: string[]) => Promise<CloudRestoreResult>;
  onRevealCloudRestore: (restoreRoot: string) => Promise<{ revealed: boolean }>;
  privacyPreferences: PrivacyPreferences;
  onPrivacyPreferencesChange: (preferences: PrivacyPreferences) => void;
  aiPreferences: AiPreferences;
  onAiPreferencesChange: (preferences: AiPreferences) => void;
  onOpenExternal: (url: string) => void;
  libraryFolders: readonly SettingsLibraryFolder[];
  libraryFileCount: number;
  onConnectLibrary: () => Promise<void>;
  onRefreshLibrary: () => Promise<void>;
  onChooseDefaultSaveFolder: () => Promise<void>;
  onDisconnectLibrary: (rootId: string) => Promise<void>;
  onClearRecentFiles: () => Promise<void>;
  onResetSettings: () => Promise<void>;
  onReplayOnboarding: () => void;
  softwareUpdateState: SoftwareUpdateState;
  softwareUpdateActions: SoftwareUpdateActions;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  initialCategory?: SettingsCategoryId;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const connectLibraryButtonRef = useRef<HTMLButtonElement>(null);
  const disconnectTriggerRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  );
  const disconnectConfirmRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  );
  const privacyActionTriggerRefs = useRef(
    new Map<"recents" | "settings", HTMLButtonElement>(),
  );
  const privacyActionConfirmRefs = useRef(
    new Map<"recents" | "settings", HTMLButtonElement>(),
  );
  const [categoryId, setCategoryId] =
    useState<SettingsCategoryId>(initialCategory);
  const [pendingDisconnectRootId, setPendingDisconnectRootId] = useState<
    string | null
  >(null);
  const [libraryAction, setLibraryAction] = useState<
    "connect" | "refresh" | "disconnect" | null
  >(null);
  const [backupAction, setBackupAction] = useState<
    "connect" | "disconnect" | "preferences" | "provider" | null
  >(null);
  const [restorePhase, setRestorePhase] = useState<
    "idle" | "listing" | "ready" | "restoring" | "success" | "error"
  >("idle");
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([]);
  const [selectedBackupIds, setSelectedBackupIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [restoreResult, setRestoreResult] = useState<CloudRestoreResult | null>(
    null,
  );
  const [restoreError, setRestoreError] = useState("");
  const [pendingPrivacyAction, setPendingPrivacyAction] = useState<
    "recents" | "settings" | null
  >(null);
  const [privacyActionBusy, setPrivacyActionBusy] = useState(false);
  const category =
    SETTINGS_CATEGORIES.find((item) => item.id === categoryId) ??
    SETTINGS_CATEGORIES[0];

  const updateDirection = (lineDirection: CodeViewLineDirection) => {
    onCodeViewPreferencesChange({ ...codeViewPreferences, lineDirection });
  };

  const updateTheme = (theme: ThemePreference) => {
    onAppearancePreferencesChange({ ...appearancePreferences, theme });
  };

  const updateAccent = (accent: AccentId) => {
    onAppearancePreferencesChange({ ...appearancePreferences, accent });
  };

  const updateMotion = (motion: MotionPreference) => {
    onAppearancePreferencesChange({ ...appearancePreferences, motion });
  };

  const updateStartupView = (startupView: StartupView) => {
    onGeneralPreferencesChange({ ...generalPreferences, startupView });
  };

  const updateReadingPreference = <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => {
    onReadingPreferencesChange({ ...readingPreferences, [key]: value });
  };

  const updateFileLibraryPreference = <
    Key extends keyof FileLibraryPreferences,
  >(
    key: Key,
    value: FileLibraryPreferences[Key],
  ) => {
    onFileLibraryPreferencesChange({ ...fileLibraryPreferences, [key]: value });
  };

  const updateBackupPreference = async <Key extends keyof BackupPreferences>(
    key: Key,
    value: BackupPreferences[Key],
  ) => {
    setBackupAction("preferences");
    try {
      await onBackupPreferencesChange({
        ...backupStatus.preferences,
        [key]: value,
      });
    } finally {
      setBackupAction(null);
    }
  };

  const runBackupConnectionAction = async (
    action: "connect" | "disconnect",
  ) => {
    setBackupAction(action);
    try {
      await (action === "connect"
        ? onConnectBackupProvider(backupStatus.providerId)
        : onDisconnectBackupProvider(backupStatus.providerId));
    } finally {
      setBackupAction(null);
    }
  };

  const selectBackupProvider = async (providerId: BackupProviderId) => {
    if (providerId === backupStatus.providerId) return;
    setBackupAction("provider");
    setRestorePhase("idle");
    setCloudBackups([]);
    setSelectedBackupIds(new Set());
    setRestoreResult(null);
    setRestoreError("");
    try {
      await onBackupProviderChange(providerId);
    } finally {
      setBackupAction(null);
    }
  };

  const loadCloudBackups = async () => {
    setRestorePhase("listing");
    setRestoreError("");
    setRestoreResult(null);
    try {
      const backups = await onListCloudBackups();
      setCloudBackups(backups);
      setSelectedBackupIds(
        new Set(
          backups
            .filter((backup) => backup.categories.textAndStructure !== false)
            .map((backup) => backup.documentId),
        ),
      );
      setRestorePhase("ready");
    } catch {
      setRestoreError(
        `فهرست بکاپ‌ها از ${activeProvider.name} دریافت نشد؛ اتصال را بررسی و دوباره تلاش کنید.`,
      );
      setRestorePhase("error");
    }
  };

  const toggleBackupSelection = (documentId: string) => {
    setSelectedBackupIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  };

  const selectAllBackups = () => {
    setSelectedBackupIds((current) =>
      current.size === cloudBackups.length
        ? new Set()
        : new Set(cloudBackups.map((backup) => backup.documentId)),
    );
  };

  const restoreSelectedBackups = async () => {
    if (!selectedBackupIds.size) return;
    setRestorePhase("restoring");
    setRestoreError("");
    try {
      const result = await onRestoreCloudBackups([...selectedBackupIds]);
      if (result.canceled) {
        setRestorePhase("ready");
        return;
      }
      setRestoreResult(result);
      setRestorePhase("success");
    } catch {
      setRestoreError(
        "بازیابی کامل نشد؛ فایل‌های موجود دست‌نخورده‌اند. اتصال و فضای مقصد را بررسی کنید و دوباره تلاش کنید.",
      );
      setRestorePhase("error");
    }
  };

  const updatePrivacyPreference = <Key extends keyof PrivacyPreferences>(
    key: Key,
    value: PrivacyPreferences[Key],
  ) => {
    onPrivacyPreferencesChange({ ...privacyPreferences, [key]: value });
  };

  const requestPrivacyAction = (action: "recents" | "settings") => {
    setPendingPrivacyAction(action);
    requestAnimationFrame(() =>
      privacyActionConfirmRefs.current.get(action)?.focus(),
    );
  };

  const cancelPrivacyAction = (action: "recents" | "settings") => {
    setPendingPrivacyAction(null);
    requestAnimationFrame(() =>
      privacyActionTriggerRefs.current.get(action)?.focus(),
    );
  };

  const runPrivacyAction = async (action: "recents" | "settings") => {
    setPrivacyActionBusy(true);
    try {
      await (action === "recents" ? onClearRecentFiles() : onResetSettings());
      setPendingPrivacyAction(null);
      if (action === "recents") {
        requestAnimationFrame(() =>
          privacyActionTriggerRefs.current.get(action)?.focus(),
        );
      }
    } finally {
      setPrivacyActionBusy(false);
    }
  };

  const runLibraryAction = async (
    action: "connect" | "refresh" | "disconnect",
    callback: () => Promise<void>,
  ) => {
    setLibraryAction(action);
    try {
      await callback();
    } catch {
      // The workspace owns the actionable error message; keep Settings open.
    } finally {
      setLibraryAction(null);
    }
  };

  const requestDisconnect = (rootId: string) => {
    setPendingDisconnectRootId(rootId);
    requestAnimationFrame(() =>
      disconnectConfirmRefs.current.get(rootId)?.focus(),
    );
  };

  const cancelDisconnect = (rootId: string) => {
    setPendingDisconnectRootId(null);
    requestAnimationFrame(() =>
      disconnectTriggerRefs.current.get(rootId)?.focus(),
    );
  };

  const selectCategory = (nextCategory: SettingsCategoryId) => {
    setCategoryId(nextCategory);
    if (window.matchMedia("(max-width: 760px)").matches) {
      requestAnimationFrame(() =>
        dialogRef.current
          ?.querySelector(".shortcut-settings-content")
          ?.scrollIntoView({ block: "start" }),
      );
    }
  };

  const navigateCategories = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % SETTINGS_CATEGORIES.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SETTINGS_CATEGORIES.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectCategory(SETTINGS_CATEGORIES[nextIndex].id);
    navItemRefs.current[nextIndex]?.focus();
  };

  const navigateRadioGroup = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      ) ?? [],
    );
    const index = buttons.indexOf(event.currentTarget);
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % buttons.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  };

  const driveQuotaState = backupStatus.quota
    ? evaluateDriveQuota(backupStatus.quota)
    : null;
  const driveUsagePercent = driveQuotaState
    ? Math.round(driveQuotaState.usageRatio * 100)
    : 0;
  const cloudConnected = backupStatus.connection.state === "connected";
  const activeProvider =
    BACKUP_PROVIDERS.find(
      (provider) => provider.id === backupStatus.providerId,
    ) ?? BACKUP_PROVIDERS[0];
  const backupPreferenceRows = [
    {
      key: "textAndStructure",
      title: "متن و ساختار",
      description: "یادداشت‌ها، عنوان، برچسب‌ها و ساختار پوشه‌ها",
    },
    {
      key: "optimizedImages",
      title: "تصاویر بهینه‌شده",
      description: "فشرده‌سازی یک‌باره و آپلود براساس هش محتوا",
    },
    {
      key: "audio",
      title: "فایل‌های صوتی",
      description: "پیش‌فرض خاموش؛ هنگام بکاپ یک‌بار به Opus کم‌حجم تبدیل می‌شود",
    },
    {
      key: "otherAttachments",
      title: "سایر پیوست‌ها",
      description: "فقط در صورت انتخاب کاربر وارد Drive شوند",
    },
    {
      key: "versionHistory",
      title: "تاریخچهٔ نسخه‌ها",
      description: "متن تا ۳۰ روز یا ۵۰ نسخه؛ نسخهٔ جاری همیشه محفوظ است",
    },
  ] as const;

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      initialFocusRef={titleRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="shortcut-settings-backdrop"
      dialogClassName="shortcut-settings"
      labelledBy="shortcut-settings-title"
      describedBy="shortcut-settings-description"
    >
      <header className="shortcut-settings-header">
        <div className="shortcut-settings-title-lockup">
          <Settings size={20} aria-hidden="true" />
          <strong>تنظیمات</strong>
        </div>
        <button
          type="button"
          className="shortcut-settings-back-button"
          onClick={onClose}
          aria-label="بازگشت به سند"
        >
          <span>بازگشت به سند</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="shortcut-settings-layout">
        <nav className="shortcut-settings-nav" aria-label="دسته‌های تنظیمات">
          <strong>دسته‌ها</strong>
          <ul>
            {SETTINGS_CATEGORIES.map((item, index) => {
              const Icon = item.icon;
              const selected = item.id === categoryId;
              return (
                <li key={item.id}>
                  <button
                    ref={(node) => {
                      navItemRefs.current[index] = node;
                    }}
                    type="button"
                    className={selected ? "is-current" : undefined}
                    aria-current={selected ? "page" : undefined}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectCategory(item.id)}
                    onKeyDown={(event) => navigateCategories(event, index)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="shortcut-settings-device-note">
            راوی ۲٫۲&nbsp; · &nbsp;تنظیم‌ها روی این دستگاه
          </p>
        </nav>

        <main
          className="shortcut-settings-content"
          data-settings-category={categoryId}
        >
          <SettingsHeading category={category} titleRef={titleRef} />

          {categoryId === "general" ? (
            <div className="general-settings" aria-label="تنظیمات عمومی">
              <SoftwareUpdateStatusCard
                state={softwareUpdateState}
                actions={softwareUpdateActions}
              />
              <section
                className="general-onboarding-row"
                aria-labelledby="general-onboarding-title"
              >
                <div>
                  <strong id="general-onboarding-title">
                    نمایش دوبارهٔ خوش‌آمدگویی
                  </strong>
                  <p>
                    مراحل انتخاب مخزن، اتصال هوش مصنوعی و پشتیبان‌گیری را دوباره اجرا کنید.
                  </p>
                </div>
                <button type="button" onClick={onReplayOnboarding}>
                  اجرای دوباره
                </button>
              </section>
              <section
                className="settings-card general-settings-section general-startup-section"
                aria-labelledby="general-startup-title"
              >
                <div className="settings-card-heading">
                  <h3 id="general-startup-title">هنگام باز شدن راوی</h3>
                  <p>انتخاب کنید اولین صفحه‌ای که می‌بینید چه باشد.</p>
                </div>
                <div
                  className="general-startup-options"
                  role="radiogroup"
                  aria-label="صفحهٔ آغاز راوی"
                >
                  {(
                    [
                      {
                        id: "recent",
                        label: "فایل‌های اخیر",
                        description: "نمایش ۹ فایل اخیر",
                      },
                      {
                        id: "workspace",
                        label: "آخرین فضای کار",
                        description: "بازگشت به آخرین سند باز",
                      },
                      {
                        id: "blank",
                        label: "صفحهٔ خالی",
                        description: "شروع سریع با یک سند تازه",
                      },
                    ] as const
                  ).map((option) => {
                    const selected = generalPreferences.startupView === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        className={`general-startup-choice${selected ? " is-selected" : ""}`}
                        onClick={() => updateStartupView(option.id)}
                        onKeyDown={navigateRadioGroup}
                      >
                        <span className="general-choice-copy">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                        <span className="general-choice-radio" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                className="settings-card general-settings-section general-resume-section"
                aria-labelledby="general-resume-title"
              >
                <div className="settings-card-heading">
                  <h3 id="general-resume-title">ادامهٔ کار</h3>
                  <p>این گزینه‌ها روی بازیابی وضعیت آخر اثر می‌گذارند.</p>
                </div>
                <div className="settings-preference-row general-preference-row">
                  <div>
                    <strong>بازیابی تب‌ها و پنل‌ها</strong>
                    <p>چیدمان آخرین فضای کار در اجرای بعدی باز شود.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="بازیابی تب‌ها و پنل‌ها"
                    aria-checked={fileLibraryPreferences.restoreDocumentTabs}
                    onClick={() =>
                      updateFileLibraryPreference(
                        "restoreDocumentTabs",
                        !fileLibraryPreferences.restoreDocumentTabs,
                      )
                    }
                  >
                    <strong>
                      {fileLibraryPreferences.restoreDocumentTabs
                        ? "فعال"
                        : "غیرفعال"}
                    </strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
                <div className="settings-preference-row general-preference-row">
                  <div>
                    <strong>باز کردن آخرین مکان مطالعه</strong>
                    <p>سند از همان بخشی باز شود که آخرین بار رها کردید.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="باز کردن آخرین مکان مطالعه"
                    aria-checked={readingPreferences.rememberPosition}
                    onClick={() =>
                      updateReadingPreference(
                        "rememberPosition",
                        !readingPreferences.rememberPosition,
                      )
                    }
                  >
                    <strong>
                      {readingPreferences.rememberPosition
                        ? "فعال"
                        : "غیرفعال"}
                    </strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
              </section>

              <section
                className="settings-card general-settings-section general-storage-section"
                aria-labelledby="general-storage-title"
              >
                <div className="settings-card-heading">
                  <h3 id="general-storage-title">ذخیره‌سازی</h3>
                  <p>مکان پیشنهادی ذخیرهٔ فایل‌های تازه.</p>
                </div>
                <div className="settings-preference-row general-preference-row">
                  <div>
                    <strong>پوشهٔ پیش‌فرض ذخیره</strong>
                    <p dir="auto">
                      {libraryFolders.find(
                        (folder) =>
                          folder.rootId ===
                          fileLibraryPreferences.activeWorkspaceRootId,
                      )?.rootPath ?? "اسناد / Raavi"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="general-folder-action"
                    onClick={() => void onChooseDefaultSaveFolder()}
                  >
                    تغییر پوشه
                  </button>
                </div>
              </section>
            </div>
          ) : categoryId === "ai" ? (
            <AiSpeechSettings
              preferences={aiPreferences}
              onPreferencesChange={onAiPreferencesChange}
              onOpenExternal={onOpenExternal}
            />
          ) : categoryId === "appearance" ? (
            <div className="appearance-settings" aria-label="تنظیمات ظاهر">
              <section
                className="settings-card appearance-theme-section"
                aria-labelledby="appearance-theme-title"
              >
                <div className="settings-card-heading">
                  <h3 id="appearance-theme-title">حالت نمایش</h3>
                  <p>
                    راوی می‌تواند از تنظیم دستگاه پیروی کند یا همیشه روشن یا
                    تاریک باشد.
                  </p>
                </div>
                <div
                  className="appearance-theme-options"
                  role="radiogroup"
                  aria-label="حالت نمایش"
                >
                  {(
                    [
                      {
                        id: "system",
                        label: "سیستم",
                        description: "همراه با دستگاه",
                        icon: Computer,
                      },
                      {
                        id: "light",
                        label: "روشن",
                        description: "مطالعه در روز",
                        icon: Sun,
                      },
                      {
                        id: "dark",
                        label: "تاریک",
                        description: "محیط کم‌نور",
                        icon: Moon,
                      },
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon;
                    const selected = appearancePreferences.theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        className={`appearance-theme-card${selected ? " is-selected" : ""}`}
                        onClick={() => updateTheme(option.id)}
                        onKeyDown={navigateRadioGroup}
                      >
                        <Icon size={22} aria-hidden="true" />
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                className="settings-card appearance-accent-section"
                aria-labelledby="appearance-accent-title"
              >
                <div className="settings-card-heading">
                  <h3 id="appearance-accent-title">رنگ رابط</h3>
                  <p>
                    رنگ دکمه‌های اصلی، لینک‌ها، فوکوس و حالت فعال را انتخاب
                    کنید. رنگ‌های خطا، هشدار و موفقیت تغییر نمی‌کنند.
                  </p>
                </div>
                <strong className="appearance-accent-current">
                  رنگ انتخاب‌شده: {ACCENT_OPTIONS.find(
                    (option) => option.id === appearancePreferences.accent,
                  )?.label ?? "آبی راوی"}
                </strong>
                <div
                  className="appearance-accent-options"
                  role="radiogroup"
                  aria-label="رنگ رابط"
                >
                  {ACCENT_OPTIONS.map((option) => {
                    const selected = appearancePreferences.accent === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-label={option.label}
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        className={selected ? "is-selected" : undefined}
                        style={{ "--swatch-color": option.color } as CSSProperties}
                        onClick={() => updateAccent(option.id)}
                        onKeyDown={navigateRadioGroup}
                      >
                        <span aria-hidden="true">
                          {selected && <Check size={18} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="appearance-accent-preview" aria-label="پیش‌نمایش رنگ">
                  <span>پیش‌نمایش</span>
                  <a href="#appearance-accent-title" onClick={(event) => event.preventDefault()}>
                    یک لینک نمونه
                  </a>
                  <button type="button">اکشن اصلی</button>
                </div>
              </section>

              <section
                className="settings-card appearance-motion-section"
                aria-labelledby="appearance-motion-title"
              >
                <div className="settings-card-heading">
                  <h3 id="appearance-motion-title">حرکت و انیمیشن</h3>
                  <p>میزان حرکت رابط را بدون تغییر عملکرد تنظیم کنید.</p>
                </div>
                <div className="appearance-motion-row">
                  <div>
                    <strong>حرکت رابط</strong>
                    <p>برای کاهش حرکت، گزینهٔ «کم‌شده» را انتخاب کنید.</p>
                  </div>
                  <div
                    className="appearance-motion-control"
                    role="radiogroup"
                    aria-label="حرکت رابط"
                  >
                    {(
                      [
                        ["normal", "معمولی"],
                        ["system", "پیروی از سیستم"],
                        ["reduced", "کم‌شده"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={appearancePreferences.motion === id}
                        tabIndex={appearancePreferences.motion === id ? 0 : -1}
                        className={appearancePreferences.motion === id ? "is-active" : undefined}
                        onClick={() => updateMotion(id)}
                        onKeyDown={navigateRadioGroup}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : categoryId === "reading" ? (
            <div className="reading-settings" aria-label="تنظیمات مطالعه">
              <section
                className="settings-card reading-settings-section"
                aria-labelledby="reading-layout-title"
              >
                <div className="settings-card-heading">
                  <h3 id="reading-layout-title">متن و چیدمان</h3>
                  <p>
                    این تنظیم‌ها فقط نمایش را تغییر می‌دهند و محتوای فایل
                    دست‌نخورده می‌ماند.
                  </p>
                </div>
                {(
                  [
                    {
                      key: "textSize",
                      title: "اندازهٔ متن",
                      description: "اندازهٔ پیش‌فرض متن در حالت مطالعه.",
                      options: [
                        ["large", "بزرگ"],
                        ["normal", "معمولی"],
                        ["small", "کوچک"],
                      ],
                    },
                    {
                      key: "lineSpacing",
                      title: "فاصلهٔ خطوط",
                      description: "فاصلهٔ بیشتر برای متن‌های طولانی.",
                      options: [
                        ["open", "باز"],
                        ["normal", "معمولی"],
                        ["compact", "فشرده"],
                      ],
                    },
                    {
                      key: "textWidth",
                      title: "عرض متن",
                      description: "عرض مناسب برای تمرکز و خوانایی.",
                      options: [
                        ["wide", "عریض"],
                        ["balanced", "متعادل"],
                        ["narrow", "باریک"],
                      ],
                    },
                  ] as const
                ).map((row) => {
                  const selected = readingPreferences[row.key];
                  return (
                    <div className="settings-preference-row" key={row.key}>
                      <div>
                        <strong>{row.title}</strong>
                        <p>{row.description}</p>
                      </div>
                      <div
                        className="settings-segmented-control"
                        role="radiogroup"
                        aria-label={row.title}
                      >
                        {row.options.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected === value}
                            tabIndex={selected === value ? 0 : -1}
                            className={selected === value ? "is-active" : undefined}
                            onClick={() =>
                              row.key === "textSize"
                                ? updateReadingPreference(
                                    row.key,
                                    value as ReadingTextSize,
                                  )
                                : row.key === "lineSpacing"
                                  ? updateReadingPreference(
                                      row.key,
                                      value as ReadingLineSpacing,
                                    )
                                  : updateReadingPreference(
                                      row.key,
                                      value as ReadingTextWidth,
                                    )
                            }
                            onKeyDown={navigateRadioGroup}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>

              <section
                className="settings-card reading-settings-section"
                aria-labelledby="reading-behavior-title"
              >
                <div className="settings-card-heading">
                  <h3 id="reading-behavior-title">رفتار مطالعه</h3>
                  <p>راوی می‌تواند وضعیت مطالعه را برای هر فایل به‌خاطر بسپارد.</p>
                </div>
                {(
                  [
                    {
                      key: "rememberPosition",
                      title: "یادآوری موقعیت مطالعه",
                      description: "بازگشت به آخرین بخش خوانده‌شده در هر فایل.",
                    },
                    {
                      key: "autoHideHeader",
                      title: "پنهان شدن خودکار هدر",
                      description: "هنگام اسکرول، فضای بیشتری به متن داده شود.",
                    },
                    {
                      key: "openOutlineOnEnter",
                      title: "باز کردن فهرست مطالب",
                      description:
                        "در فایل‌های دارای ساختار، فهرست هنگام ورود باز باشد.",
                    },
                  ] as const
                ).map((row) => {
                  const checked = readingPreferences[row.key];
                  return (
                    <div className="settings-preference-row" key={row.key}>
                      <div>
                        <strong>{row.title}</strong>
                        <p>{row.description}</p>
                      </div>
                      <button
                        type="button"
                        className="settings-switch"
                        role="switch"
                        aria-label={row.title}
                        aria-checked={checked}
                        onClick={() =>
                          updateReadingPreference(row.key, !checked)
                        }
                      >
                        <strong>{checked ? "فعال" : "غیرفعال"}</strong>
                        <span className="settings-switch-track" aria-hidden="true">
                          <span />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </section>
            </div>
          ) : categoryId === "files" ? (
            <div className="file-library-settings" aria-label="تنظیمات فایل‌ها و کتابخانه">
              <section
                className={`settings-card backup-drive-card is-${backupStatus.connection.state}`}
                aria-labelledby="backup-drive-account-title"
              >
                <div className="settings-card-heading backup-drive-heading">
                  <div>
                    <h3 id="backup-drive-account-title">حساب و فضای ذخیره‌سازی</h3>
                    <p>
                      {cloudConnected
                        ? `اتصال ${activeProvider.name} فعال است و تغییرها خودکار ارسال می‌شوند.`
                        : activeProvider.id === "google-drive"
                          ? "بدون ساخت حساب جداگانه، Drive خودتان را به راوی متصل کنید."
                          : "ورود امن Proton در مرورگر انجام می‌شود و رمز عبور وارد راوی نمی‌شود."}
                    </p>
                  </div>
                  <img
                    className="backup-drive-brand"
                    src={activeProvider.logo}
                    width="32"
                    height="32"
                    alt={activeProvider.name}
                  />
                </div>

                <div
                  className="backup-provider-options"
                  role="radiogroup"
                  aria-label="فضای پشتیبان‌گیری"
                >
                  {BACKUP_PROVIDERS.map((provider) => {
                    const selected = provider.id === backupStatus.providerId;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        className={selected ? "is-selected" : ""}
                        role="radio"
                        aria-checked={selected}
                        disabled={backupAction !== null}
                        onClick={() => void selectBackupProvider(provider.id)}
                      >
                        <img
                          src={provider.logo}
                          width="28"
                          height="28"
                          alt=""
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{provider.name}</strong>
                          <small>{provider.description}</small>
                        </span>
                        <span className="backup-provider-indicator" aria-hidden="true">
                          {selected && <Check size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="backup-drive-account-row">
                  <div className="backup-drive-account-copy">
                    <strong>
                      {cloudConnected
                        ? backupStatus.connection.accountEmail || `${activeProvider.name} متصل`
                        : backupStatus.connection.state === "reauth"
                          ? "نیاز به ورود دوباره"
                          : backupStatus.connection.state === "error"
                            ? "اتصال کامل نشد"
                            : `${activeProvider.name} متصل نیست`}
                    </strong>
                    <span>
                      {cloudConnected
                        ? backupStatus.syncState === "up-to-date"
                          ? "همگام است؛ تغییرهای بعدی خودکار ارسال می‌شوند."
                          : `${backupStatus.queuedDocuments.toLocaleString("fa-IR")} سند در صف همگام‌سازی`
                        : "ذخیرهٔ محلی و مخزن بدون اتصال هم ادامه دارد."}
                    </span>
                  </div>
                  {cloudConnected ? (
                    <button
                      type="button"
                      className="backup-drive-secondary-action"
                      disabled={backupAction !== null}
                      onClick={() => void runBackupConnectionAction("disconnect")}
                    >
                      {backupAction === "disconnect" ? "در حال قطع" : "قطع اتصال"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`backup-provider-connect is-${activeProvider.id}`}
                      disabled={backupAction !== null}
                      onClick={() => void runBackupConnectionAction("connect")}
                    >
                      <img
                        src={
                          activeProvider.id === "google-drive"
                            ? "/brands/google/google-sign-in-g.svg"
                            : activeProvider.logo
                        }
                        width="40"
                        height="40"
                        alt=""
                        aria-hidden="true"
                      />
                      <span>
                        {backupAction === "connect"
                          ? "در حال اتصال"
                          : backupStatus.connection.state === "reauth"
                            ? `ورود دوباره به ${activeProvider.name}`
                            : `اتصال به ${activeProvider.name}`}
                      </span>
                    </button>
                  )}
                </div>

                {(backupStatus.connectionError || backupStatus.lastError) && (
                  <p className="backup-drive-error" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>
                      {backupStatus.connectionError?.code === "oauth-client-missing"
                        ? "شناسهٔ OAuth این نسخه هنوز تنظیم نشده است؛ RAAVI_GOOGLE_CLIENT_ID را برای نسخهٔ توسعه قرار دهید."
                        : backupStatus.connectionError?.code === "oauth-client-secret-missing"
                          ? "مجوز اتصال Google Drive در این نسخه کامل بسته‌بندی نشده است."
                          : backupStatus.connectionError?.code === "proton-cli-missing"
                            ? "فایل رسمی proton-drive.exe پیدا نشد؛ آن را در پوشهٔ Downloads بگذارید و دوباره تلاش کنید."
                            : backupStatus.connectionError?.code === "proton-cli-checksum"
                              ? "فایل Proton Drive معتبر نیست یا نسخهٔ آن با راوی سازگار نیست."
                              : backupStatus.connectionError?.code === "proton-cli-busy"
                                ? "یک اجرای دیگر Proton Drive باز مانده است؛ آن را ببندید و دوباره تلاش کنید."
                                : backupStatus.connectionError?.code === "proton-network"
                                  ? "شبکهٔ فعلی به سرورهای Proton دسترسی ندارد؛ مسیر اینترنت، VPN یا Proxy را بررسی کنید."
                        : "اتصال یا همگام‌سازی کامل نشد؛ فایل‌های محلی محفوظ‌اند و می‌توانید دوباره تلاش کنید."}
                    </span>
                  </p>
                )}

                {backupStatus.lastWarning && (
                  <p className="backup-drive-warning" role="status">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>{backupStatus.lastWarning}</span>
                  </p>
                )}

                {activeProvider.id === "proton-drive" && cloudConnected && (
                  <p className="backup-provider-note">
                    سهمیه و جزئیات فضا در حساب Proton مدیریت می‌شود؛ راوی محدودیت جداگانه‌ای اعمال نمی‌کند.
                  </p>
                )}

                {backupStatus.quota && driveQuotaState && (
                  <div
                    className={`backup-storage-meter is-${driveQuotaState.level}`}
                    aria-label={`${driveUsagePercent.toLocaleString("fa-IR")} درصد فضای ${activeProvider.name} استفاده شده`}
                  >
                    <div>
                      <strong>
                        {formatStorageBytes(backupStatus.quota.usageBytes)} استفاده شده
                      </strong>
                      <span>
                        از {formatStorageBytes(backupStatus.quota.limitBytes)}
                      </span>
                    </div>
                    <span className="backup-storage-track" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, driveUsagePercent)}%` }} />
                    </span>
                    <small>
                      حاشیهٔ امن: {formatStorageBytes(driveQuotaState.safetyReserveBytes)}
                    </small>
                  </div>
                )}
              </section>

              <section
                className="settings-card backup-restore-section"
                aria-labelledby="backup-restore-title"
              >
                <div className="settings-card-heading backup-restore-heading">
                  <div>
                    <h3 id="backup-restore-title">بازیابی روی این دستگاه</h3>
                    <p>
                      بکاپ‌های قبلی را پیدا کنید؛ راوی آن‌ها را بدون بازنویسی
                      فایل‌های موجود داخل یک پوشهٔ تازه برمی‌گرداند.
                    </p>
                  </div>
                  <span className="backup-restore-icon" aria-hidden="true">
                    <History size={20} />
                  </span>
                </div>

                {(restorePhase === "idle" || restorePhase === "listing") && (
                  <div className="backup-restore-start">
                    <div>
                      <strong>
                        {cloudConnected
                          ? `مخزن قبلی ${activeProvider.name} آمادهٔ بررسی است`
                          : `ابتدا ${activeProvider.name} را متصل کنید`}
                      </strong>
                      <span>
                        همهٔ اسناد به‌صورت پیش‌فرض انتخاب می‌شوند و مقصد را خودتان
                        تعیین می‌کنید.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="backup-restore-primary"
                      disabled={!cloudConnected || restorePhase === "listing"}
                      onClick={() => void loadCloudBackups()}
                    >
                      {restorePhase === "listing" ? (
                        <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
                      ) : (
                        <Download size={18} aria-hidden="true" />
                      )}
                      <span>
                        {restorePhase === "listing"
                          ? "در حال یافتن بکاپ‌ها"
                          : cloudConnected
                            ? "پیدا کردن بکاپ‌ها"
                            : "نیاز به اتصال"}
                      </span>
                    </button>
                  </div>
                )}

                {restorePhase === "ready" && cloudBackups.length === 0 && (
                  <div className="backup-restore-empty" role="status">
                    <History size={22} aria-hidden="true" />
                    <div>
                      <strong>بکاپی در این حساب پیدا نشد</strong>
                      <span>
                        اگر با حساب دیگری بکاپ گرفته‌اید، اتصال را عوض کنید و
                        دوباره بررسی کنید.
                      </span>
                    </div>
                    <button type="button" onClick={() => void loadCloudBackups()}>
                      بررسی دوباره
                    </button>
                  </div>
                )}

                {restorePhase === "ready" && cloudBackups.length > 0 && (
                  <div className="backup-restore-picker">
                    <div className="backup-restore-selection-bar">
                      <div>
                        <strong>
                          {selectedBackupIds.size.toLocaleString("fa-IR")} از{" "}
                          {cloudBackups.length.toLocaleString("fa-IR")} سند
                        </strong>
                        <span>نسخهٔ جاری و تاریخچهٔ موجود بازیابی می‌شوند.</span>
                      </div>
                      <button type="button" onClick={selectAllBackups}>
                        {selectedBackupIds.size === cloudBackups.length
                          ? "لغو انتخاب همه"
                          : "انتخاب همه"}
                      </button>
                    </div>
                    <ul className="backup-restore-list">
                      {cloudBackups.map((backup) => {
                        const mediaCount =
                          backup.assetCount +
                          backup.audioCount +
                          backup.attachmentCount;
                        return (
                          <li key={backup.documentId}>
                            <label>
                              <input
                                type="checkbox"
                                checked={selectedBackupIds.has(backup.documentId)}
                                onChange={() =>
                                  toggleBackupSelection(backup.documentId)
                                }
                              />
                              <span className="backup-restore-check" aria-hidden="true">
                                <Check size={14} />
                              </span>
                              <span className="backup-restore-copy">
                                <strong>{backup.fileName}</strong>
                                <small>
                                  {formatBackupDate(backup.backedUpAt)}
                                  {` · ${backup.versionCount.toLocaleString("fa-IR")} نسخه`}
                                  {mediaCount
                                    ? ` · ${mediaCount.toLocaleString("fa-IR")} رسانه`
                                    : ""}
                                </small>
                              </span>
                              {backup.categories.textAndStructure === false && (
                                <span className="backup-restore-media-only">
                                  فقط رسانه
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="backup-restore-actions">
                      <button
                        type="button"
                        className="backup-restore-secondary"
                        onClick={() => void loadCloudBackups()}
                      >
                        به‌روزرسانی فهرست
                      </button>
                      <button
                        type="button"
                        className="backup-restore-primary"
                        disabled={!selectedBackupIds.size}
                        onClick={() => void restoreSelectedBackups()}
                      >
                        <Download size={18} aria-hidden="true" />
                        بازیابی {selectedBackupIds.size.toLocaleString("fa-IR")} سند
                      </button>
                    </div>
                  </div>
                )}

                {restorePhase === "restoring" && (
                  <div className="backup-restore-progress" role="status" aria-live="polite">
                    <LoaderCircle className="is-spinning" size={24} aria-hidden="true" />
                    <div>
                      <strong>در حال بازیابی امن فایل‌ها</strong>
                      <span>
                        این مرحله ممکن است برای رسانه‌ها کمی طول بکشد؛ فایل‌های
                        فعلی شما تغییر نمی‌کنند.
                      </span>
                    </div>
                  </div>
                )}

                {restorePhase === "success" && restoreResult && (
                  <div className="backup-restore-success" role="status" aria-live="polite">
                    <span className="backup-restore-success-icon" aria-hidden="true">
                      <Check size={18} />
                    </span>
                    <div>
                      <strong>
                        {restoreResult.restored.length.toLocaleString("fa-IR")} سند
                        بازیابی شد
                        {restoreResult.failed.length > 0
                          ? `؛ ${restoreResult.failed.length.toLocaleString("fa-IR")} سند ناموفق بود`
                          : ""}
                      </strong>
                      <span>
                        {restoreResult.failed.length > 0
                          ? "پوشهٔ تازه به کتابخانه اضافه شد و خطاهای باقی‌مانده به سندهای سالم آسیبی نزدند."
                          : "پوشهٔ تازه به کتابخانهٔ راوی اضافه شد و برای استفاده آماده است."}
                      </span>
                      {restoreResult.restoreRoot && (
                        <code dir="ltr">{restoreResult.restoreRoot}</code>
                      )}
                    </div>
                    <div className="backup-restore-success-actions">
                      {restoreResult.restoreRoot && (
                        <button
                          type="button"
                          className="backup-restore-primary"
                          onClick={() =>
                            void onRevealCloudRestore(
                              restoreResult.restoreRoot ?? "",
                            )
                          }
                        >
                          <FolderOpen size={18} aria-hidden="true" />
                          نمایش پوشه
                        </button>
                      )}
                      <button type="button" onClick={() => void loadCloudBackups()}>
                        بازیابی دوباره
                      </button>
                    </div>
                  </div>
                )}

                {restorePhase === "error" && (
                  <div className="backup-restore-error" role="alert">
                    <AlertTriangle size={20} aria-hidden="true" />
                    <div>
                      <strong>بازیابی ادامه پیدا نکرد</strong>
                      <span>{restoreError}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!cloudConnected}
                      onClick={() => void loadCloudBackups()}
                    >
                      تلاش دوباره
                    </button>
                  </div>
                )}
              </section>

              <section
                className="settings-card backup-policy-section"
                aria-labelledby="backup-policy-title"
              >
                <div className="settings-card-heading">
                  <h3 id="backup-policy-title">چه چیزهایی بکاپ شوند؟</h3>
                  <p>این قاعده روی فایل‌های داخل مخزن اعمال می‌شود؛ کش مطالعه همیشه خارج می‌ماند.</p>
                </div>
                <div className="backup-policy-rows">
                  {backupPreferenceRows.map((row) => {
                    const checked = backupStatus.preferences[row.key];
                    return (
                      <div className="settings-preference-row" key={row.key}>
                        <div>
                          <strong>{row.title}</strong>
                          <p>{row.description}</p>
                        </div>
                        <button
                          type="button"
                          className="settings-switch"
                          role="switch"
                          aria-label={row.title}
                          aria-checked={checked}
                          disabled={backupAction === "preferences"}
                          onClick={() =>
                            void updateBackupPreference(row.key, !checked)
                          }
                        >
                          <strong>{checked ? "فعال" : "غیرفعال"}</strong>
                          <span className="settings-switch-track" aria-hidden="true">
                            <span />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {driveQuotaState?.level === "critical" && (
                <section
                  className="settings-card backup-critical-section"
                  aria-labelledby="backup-critical-title"
                >
                  <div className="settings-card-heading">
                    <h3 id="backup-critical-title">فضای امن کافی نیست</h3>
                    <p>آپلود رسانه موقتاً متوقف است؛ ذخیرهٔ فوری متن در مخزن ادامه دارد.</p>
                  </div>
                  <div className="backup-critical-protection">
                    <Check size={18} aria-hidden="true" />
                    <span>فایل جاری، نسخه‌های سنجاق‌شده و دارایی‌های دارای ارجاع حذف نمی‌شوند.</span>
                  </div>
                </section>
              )}

              <section
                className="settings-card file-library-settings-section is-single-row"
                aria-labelledby="file-open-title"
              >
                <div className="settings-card-heading">
                  <h3 id="file-open-title">باز کردن فایل‌ها</h3>
                  <p>حالت نخست اسناد موجود را مشخص کنید؛ سند تازه همیشه برای نوشتن باز می‌شود.</p>
                </div>
                <div className="settings-preference-row">
                  <div>
                    <strong>حالت پیش‌فرض سند</strong>
                    <p>فایل‌های بازشده در حالت مطالعه یا نوشتن نمایش داده شوند.</p>
                  </div>
                  <div
                    className="settings-segmented-control is-two-option"
                    role="radiogroup"
                    aria-label="حالت پیش‌فرض سند"
                  >
                    {(
                      [
                        ["reading", "مطالعه"],
                        ["writing", "نوشتن"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={fileLibraryPreferences.defaultOpenMode === value}
                        tabIndex={fileLibraryPreferences.defaultOpenMode === value ? 0 : -1}
                        className={fileLibraryPreferences.defaultOpenMode === value ? "is-active" : undefined}
                        onClick={() =>
                          updateFileLibraryPreference(
                            "defaultOpenMode",
                            value as FileOpenMode,
                          )
                        }
                        onKeyDown={navigateRadioGroup}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-preference-row">
                  <div>
                    <strong>بازیابی تب‌های نشست قبلی</strong>
                    <p>پس از باز شدن برنامه، سندهای باز و تب فعال دوباره نمایش داده شوند.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="بازیابی تب‌های نشست قبلی"
                    aria-checked={fileLibraryPreferences.restoreDocumentTabs}
                    onClick={() =>
                      updateFileLibraryPreference(
                        "restoreDocumentTabs",
                        !fileLibraryPreferences.restoreDocumentTabs,
                      )
                    }
                  >
                    <strong>{fileLibraryPreferences.restoreDocumentTabs ? "فعال" : "غیرفعال"}</strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
              </section>

              <section
                className="settings-card file-library-settings-section"
                aria-labelledby="local-library-title"
              >
                <div className="settings-card-heading">
                  <h3 id="local-library-title">کتابخانهٔ محلی</h3>
                  <p>نمایش فایل‌ها و به‌روزرسانی پوشه‌های متصل را کنترل کنید.</p>
                </div>
                <div className="settings-preference-row">
                  <div>
                    <strong>نمایش در کتابخانه</strong>
                    <p>نوع فایل‌هایی که در پنل کتابخانه دیده می‌شوند.</p>
                  </div>
                  <div
                    className="settings-segmented-control"
                    role="radiogroup"
                    aria-label="نمایش در کتابخانه"
                  >
                    {(
                      [
                        ["all", "همه"],
                        ["markdown", "Markdown"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={fileLibraryPreferences.fileVisibility === value}
                        tabIndex={fileLibraryPreferences.fileVisibility === value ? 0 : -1}
                        className={fileLibraryPreferences.fileVisibility === value ? "is-active" : undefined}
                        onClick={() =>
                          updateFileLibraryPreference(
                            "fileVisibility",
                            value as LibraryFileVisibility,
                          )
                        }
                        onKeyDown={navigateRadioGroup}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-preference-row">
                  <div>
                    <strong>به‌روزرسانی خودکار</strong>
                    <p>تغییر فایل‌های پوشه در همان لحظه در کتابخانه دیده شود.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="به‌روزرسانی خودکار"
                    aria-checked={fileLibraryPreferences.autoRefresh}
                    onClick={() =>
                      updateFileLibraryPreference(
                        "autoRefresh",
                        !fileLibraryPreferences.autoRefresh,
                      )
                    }
                  >
                    <strong>{fileLibraryPreferences.autoRefresh ? "فعال" : "غیرفعال"}</strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
              </section>

              <section
                className="settings-card file-library-settings-section connected-folders-section"
                aria-labelledby="connected-folders-title"
              >
                <div className="settings-card-heading file-library-section-heading">
                  <div>
                    <h3 id="connected-folders-title">پوشه‌های متصل</h3>
                    <p>
                      {libraryFolders.length.toLocaleString("fa-IR")} پوشه · {libraryFileCount.toLocaleString("fa-IR")} فایل
                    </p>
                  </div>
                  <div className="file-library-heading-actions">
                    <button
                      type="button"
                      onClick={() => void runLibraryAction("refresh", onRefreshLibrary)}
                      disabled={libraryAction !== null}
                    >
                      <RefreshCw size={18} aria-hidden="true" />
                      <span>{libraryAction === "refresh" ? "در حال بررسی" : "به‌روزرسانی"}</span>
                    </button>
                    <button
                      ref={connectLibraryButtonRef}
                      type="button"
                      className="is-primary"
                      onClick={() => void runLibraryAction("connect", onConnectLibrary)}
                      disabled={libraryAction !== null}
                    >
                      <FolderPlus size={18} aria-hidden="true" />
                      <span>{libraryAction === "connect" ? "در حال افزودن" : "افزودن پوشه"}</span>
                    </button>
                  </div>
                </div>

                {libraryFolders.length ? (
                  <ul className="connected-folder-list" aria-label="پوشه‌های متصل">
                    {libraryFolders.map((folder) => {
                      const confirming = pendingDisconnectRootId === folder.rootId;
                      const active =
                        fileLibraryPreferences.activeWorkspaceRootId ===
                        folder.rootId;
                      return (
                        <li
                          key={folder.rootId}
                          className={`${confirming ? "is-confirming" : ""}${active ? " is-active-workspace" : ""}`.trim() || undefined}
                        >
                          <div>
                            <strong dir="auto">
                              {folder.rootName}
                              {active && <small>دفتر فعال</small>}
                            </strong>
                            <span dir="auto">
                              {folder.fileCount.toLocaleString("fa-IR")} فایل
                              {folder.rootPath
                                ? ` · ${folder.rootPath}`
                                : folder.sessionOnly
                                  ? " · فقط تا بستن این صفحه"
                                  : " · دسترسی پایدار مرورگر"}
                            </span>
                          </div>
                          {confirming ? (
                            <div className="connected-folder-confirm" role="group" aria-label={`قطع اتصال ${folder.rootName}`}>
                              <button type="button" onClick={() => cancelDisconnect(folder.rootId)}>
                                انصراف
                              </button>
                              <button
                                ref={(node) => {
                                  if (node) disconnectConfirmRefs.current.set(folder.rootId, node);
                                  else disconnectConfirmRefs.current.delete(folder.rootId);
                                }}
                                type="button"
                                className="is-danger"
                                disabled={libraryAction !== null}
                                onClick={() =>
                                  void runLibraryAction("disconnect", async () => {
                                    await onDisconnectLibrary(folder.rootId);
                                    setPendingDisconnectRootId(null);
                                    requestAnimationFrame(() =>
                                      connectLibraryButtonRef.current?.focus(),
                                    );
                                  })
                                }
                              >
                                قطع اتصال
                              </button>
                            </div>
                          ) : (
                            <div className="connected-folder-actions">
                              {!active && (
                                <button
                                  type="button"
                                  className="connected-folder-activate"
                                  onClick={() =>
                                    updateFileLibraryPreference(
                                      "activeWorkspaceRootId",
                                      folder.rootId,
                                    )
                                  }
                                >
                                  انتخاب به‌عنوان دفتر
                                </button>
                              )}
                              <button
                                ref={(node) => {
                                  if (node) disconnectTriggerRefs.current.set(folder.rootId, node);
                                  else disconnectTriggerRefs.current.delete(folder.rootId);
                                }}
                                type="button"
                                className="connected-folder-disconnect"
                                onClick={() => requestDisconnect(folder.rootId)}
                              >
                                قطع اتصال
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="connected-folders-empty">
                    <Folder size={22} aria-hidden="true" />
                    <div>
                      <strong>هنوز پوشه‌ای متصل نیست</strong>
                      <p>یک پوشهٔ محلی اضافه کنید تا فایل‌های Markdown در کتابخانه دیده شوند.</p>
                    </div>
                  </div>
                )}
                <p className="file-library-local-note">فقط روی این دستگاه · قطع اتصال هیچ فایلی را حذف نمی‌کند</p>
              </section>
            </div>
          ) : categoryId === "privacy" ? (
            <div className="privacy-settings" aria-label="تنظیمات حریم خصوصی و داده‌ها">
              <section
                className="settings-card privacy-settings-section privacy-image-section"
                aria-labelledby="privacy-images-title"
              >
                <div className="settings-card-heading">
                  <h3 id="privacy-images-title">تصاویر بیرونی</h3>
                  <p>تصاویر اینترنتی ممکن است نشانی شبکهٔ شما را برای میزبان تصویر آشکار کنند.</p>
                </div>
                <div
                  className="privacy-image-options"
                  role="radiogroup"
                  aria-label="شیوهٔ بارگیری تصاویر بیرونی"
                >
                  {(
                    [
                      ["block", "همیشه مسدود", "تا زمانی که اجازه ندهید بارگیری نمی‌شوند"],
                      ["ask", "هر بار بپرس", "پیش از بارگیری از شما اجازه می‌گیرد"],
                      ["allow", "همیشه بارگیری", "تصاویر بیرونی بدون پرسش نمایش داده می‌شوند"],
                    ] as const
                  ).map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={privacyPreferences.externalImagePolicy === value}
                      tabIndex={privacyPreferences.externalImagePolicy === value ? 0 : -1}
                      className={`privacy-image-choice ${
                        privacyPreferences.externalImagePolicy === value ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        updatePrivacyPreference(
                          "externalImagePolicy",
                          value as ExternalImagePolicy,
                        )
                      }
                      onKeyDown={navigateRadioGroup}
                    >
                      <span aria-hidden="true" />
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section
                className="settings-card privacy-settings-section privacy-link-section"
                aria-labelledby="privacy-links-title"
              >
                <div className="settings-card-heading">
                  <h3 id="privacy-links-title">لینک‌ها</h3>
                  <p>رفتار لینک‌هایی که از راوی خارج می‌شوند.</p>
                </div>
                <div className="settings-preference-row">
                  <div>
                    <strong>هشدار پیش از باز کردن لینک بیرونی</strong>
                    <p>پیش از خروج از برنامه، مقصد لینک را نشان بده.</p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="هشدار پیش از باز کردن لینک بیرونی"
                    aria-checked={privacyPreferences.warnBeforeExternalLinks}
                    onClick={() =>
                      updatePrivacyPreference(
                        "warnBeforeExternalLinks",
                        !privacyPreferences.warnBeforeExternalLinks,
                      )
                    }
                  >
                    <strong>{privacyPreferences.warnBeforeExternalLinks ? "فعال" : "غیرفعال"}</strong>
                    <span className="settings-switch-track" aria-hidden="true"><span /></span>
                  </button>
                </div>
              </section>

              <section
                className="settings-card privacy-settings-section privacy-data-section"
                aria-labelledby="privacy-data-title"
              >
                <div className="settings-card-heading">
                  <h3 id="privacy-data-title">داده‌های این دستگاه</h3>
                  <p>این اکشن‌ها فقط داده‌های محلی را تغییر می‌دهند.</p>
                </div>
                {(
                  [
                    ["recents", "پاک کردن فهرست فایل‌های اخیر", "خود فایل‌ها حذف نمی‌شوند.", "پاک کردن"],
                    ["settings", "بازنشانی همهٔ تنظیمات", "فایل‌ها حذف نمی‌شوند و فقط تنظیم‌ها به حالت پیش‌فرض برمی‌گردند.", "بازنشانی"],
                  ] as const
                ).map(([action, label, description, actionLabel]) => (
                  <div className="settings-preference-row privacy-data-row" key={action}>
                    <div>
                      <strong>{label}</strong>
                      <p>{description}</p>
                    </div>
                    {pendingPrivacyAction === action ? (
                      <div className="privacy-action-confirm" role="group" aria-label={`تأیید ${label}`}>
                        <button type="button" onClick={() => cancelPrivacyAction(action)} disabled={privacyActionBusy}>انصراف</button>
                        <button
                          ref={(node) => {
                            if (node) privacyActionConfirmRefs.current.set(action, node);
                            else privacyActionConfirmRefs.current.delete(action);
                          }}
                          type="button"
                          className="is-danger"
                          onClick={() => void runPrivacyAction(action)}
                          disabled={privacyActionBusy}
                        >
                          {privacyActionBusy ? "در حال انجام" : "تأیید"}
                        </button>
                      </div>
                    ) : (
                      <button
                        ref={(node) => {
                          if (node) privacyActionTriggerRefs.current.set(action, node);
                          else privacyActionTriggerRefs.current.delete(action);
                        }}
                        type="button"
                        className="privacy-data-action"
                        onClick={() => requestPrivacyAction(action)}
                      >
                        {actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            </div>
          ) : categoryId === "editing" ? (
            <section
              className="code-view-settings-card"
              aria-labelledby="editing-tools-settings-title"
            >
              <div className="code-view-settings-heading">
                <strong id="editing-tools-settings-title">
                  ابزارهای ویرایش
                </strong>
              </div>
              <div className="code-view-settings-controls">
                <div className="code-view-settings-row">
                  <div>
                    <strong id="contextual-hints-settings-title">
                      راهنمای کلیدهای بلاک فعال
                    </strong>
                    <p>
                      میان‌برهای معتبر همان وضعیت را با یک ردیف بسیار فشرده زیر
                      بلاک فعال نشان می‌دهد.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="راهنمای کلیدهای بلاک فعال"
                    aria-checked={codeViewPreferences.contextualHintsVisible}
                    onClick={() =>
                      onCodeViewPreferencesChange({
                        ...codeViewPreferences,
                        contextualHintsVisible:
                          !codeViewPreferences.contextualHintsVisible,
                      })
                    }
                  >
                    <strong>
                      {codeViewPreferences.contextualHintsVisible
                        ? "فعال"
                        : "غیرفعال"}
                    </strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
                <div className="code-view-settings-row">
                  <div>
                    <strong id="code-toolbar-settings-title">
                      نمایش تولبار پایین در نمای کد
                    </strong>
                    <p>
                      در صورت خاموش‌بودن، منوی / و Command Palette همچنان فعال
                      می‌مانند.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="settings-switch"
                    role="switch"
                    aria-label="تولبار پایین نمای کد"
                    aria-checked={codeViewPreferences.toolbarVisible}
                    onClick={() =>
                      onCodeViewPreferencesChange({
                        ...codeViewPreferences,
                        toolbarVisible: !codeViewPreferences.toolbarVisible,
                      })
                    }
                  >
                    <strong>
                      {codeViewPreferences.toolbarVisible ? "فعال" : "غیرفعال"}
                    </strong>
                    <span className="settings-switch-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
                <div className="code-view-settings-direction">
                  <div>
                    <strong>جهت پیش‌فرض خطوط در نمای کد</strong>
                    <p>
                      خودکار برای متن ترکیبی پیشنهاد می‌شود؛ انتخاب فقط نمایش را
                      تغییر می‌دهد.
                    </p>
                  </div>
                  <div
                    className="settings-segmented-control"
                    role="radiogroup"
                    aria-label="جهت پیش‌فرض خطوط"
                  >
                    {(["auto", "rtl", "ltr"] as const).map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        role="radio"
                        aria-checked={
                          codeViewPreferences.lineDirection === direction
                        }
                        tabIndex={
                          codeViewPreferences.lineDirection === direction ? 0 : -1
                        }
                        className={
                          codeViewPreferences.lineDirection === direction
                            ? "is-active"
                            : undefined
                        }
                        onClick={() => updateDirection(direction)}
                        onKeyDown={navigateRadioGroup}
                        dir="ltr"
                      >
                        {direction === "auto"
                          ? "خودکار"
                          : direction.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="code-view-bidi-contract">
                <strong>قرارداد متن ترکیبی</strong>
                <p>
                  Auto / RTL / LTR فقط چیدمان را تغییر می‌دهند؛ LRM، RLM یا
                  نویسهٔ جهت مخفی به Markdown افزوده نمی‌شود.
                </p>
              </div>
            </section>
          ) : categoryId === "shortcuts" ? (
            <SettingsShortcutSections environment={environment} />
          ) : (
            <section
              className="shortcut-settings-section-placeholder"
              aria-label={category.label}
            >
              <Settings size={20} aria-hidden="true" />
              <div>
                <strong>تنظیم‌های {category.label}</strong>
                <p>
                  ساختار این دسته آماده است و کنترل‌های آن در مرحلهٔ اختصاصی
                  همین بخش اضافه می‌شوند.
                </p>
              </div>
            </section>
          )}
        </main>
      </div>
    </AccessibleModal>
  );
}
