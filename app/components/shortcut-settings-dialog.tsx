"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Computer,
  Folder,
  FolderPlus,
  Home,
  Keyboard,
  Library,
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
  ExternalImagePolicy,
  PrivacyPreferences,
} from "../settings/privacy-preferences";
import type { CommandEnvironment } from "../keyboard/command-registry";
import { AccessibleModal } from "./accessible-modal";
import { SettingsShortcutSections } from "./settings-shortcut-sections";

export type SettingsCategoryId =
  | "general"
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
    label: "فایل‌ها و دفتر",
    description: "پوشهٔ مرکزی، تب‌های نشست و رفتار ذخیره‌سازی را مدیریت کنید.",
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
      "فرمان‌های سریع بلاک و قالب‌بندی را مرور کنید؛ همهٔ مسیرها بدون ماوس قابل استفاده‌اند.",
    icon: Keyboard,
  },
] as const;

function SettingsHeading({
  category,
  titleRef,
}: {
  category: SettingsCategory;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      <div className="shortcut-settings-heading">
        <h2 id="shortcut-settings-title" ref={titleRef} tabIndex={-1}>
          {category.id === "editing"
            ? "ویرایش و نمای کد"
            : category.id === "shortcuts"
              ? "میان‌برهای ویرایش"
              : category.label}
        </h2>
        <p id="shortcut-settings-description">{category.description}</p>
      </div>
      {category.id !== "editing" && category.id !== "shortcuts" && (
        <p className="shortcut-settings-autosave">
          تغییرها خودکار روی این دستگاه ذخیره می‌شوند.
        </p>
      )}
    </>
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
  readingPreferences,
  onReadingPreferencesChange,
  fileLibraryPreferences,
  onFileLibraryPreferencesChange,
  privacyPreferences,
  onPrivacyPreferencesChange,
  libraryFolders,
  libraryFileCount,
  onConnectLibrary,
  onRefreshLibrary,
  onDisconnectLibrary,
  onClearRecentFiles,
  onResetSettings,
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
  readingPreferences: ReadingPreferences;
  onReadingPreferencesChange: (preferences: ReadingPreferences) => void;
  fileLibraryPreferences: FileLibraryPreferences;
  onFileLibraryPreferencesChange: (preferences: FileLibraryPreferences) => void;
  privacyPreferences: PrivacyPreferences;
  onPrivacyPreferencesChange: (preferences: PrivacyPreferences) => void;
  libraryFolders: readonly SettingsLibraryFolder[];
  libraryFileCount: number;
  onConnectLibrary: () => Promise<void>;
  onRefreshLibrary: () => Promise<void>;
  onDisconnectLibrary: (rootId: string) => Promise<void>;
  onClearRecentFiles: () => Promise<void>;
  onResetSettings: () => Promise<void>;
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
        <button type="button" onClick={onClose} aria-label="بازگشت به سند">
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
            Raavi 2.0&nbsp; · &nbsp;تنظیم‌ها روی این دستگاه
          </p>
        </nav>

        <main
          className="shortcut-settings-content"
          data-settings-category={categoryId}
        >
          <SettingsHeading category={category} titleRef={titleRef} />

          {categoryId === "appearance" ? (
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
            <div className="file-library-settings" aria-label="تنظیمات فایل‌ها و دفتر">
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
