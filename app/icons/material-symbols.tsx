"use client";

import {
  forwardRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGAttributes,
} from "react";
import { MATERIAL_SYMBOL_PATHS } from "./material-symbol-paths";

/**
 * A Lucide-compatible surface backed by Google's Material Symbols Rounded SVGs.
 * Keeping the compatibility layer central lets the product migrate iconography
 * without duplicating size, accessibility, or state logic at every call site.
 */
export type MaterialSymbolProps = Omit<
  SVGAttributes<SVGSVGElement>,
  "children" | "height" | "width"
> & {
  size?: number | string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  fill?: string | number;
  title?: string;
};

export type LucideIcon = ForwardRefExoticComponent<
  MaterialSymbolProps & RefAttributes<SVGSVGElement>
>;

type MaterialSymbolStyle = CSSProperties & {
  "--material-symbol-fill"?: number;
};

function normaliseSize(size: number | string | undefined) {
  return typeof size === "number" ? `${size}px` : (size ?? "24px");
}

function makeMaterialSymbol(
  symbol: keyof typeof MATERIAL_SYMBOL_PATHS,
): LucideIcon {
  const MaterialSymbol = forwardRef<SVGSVGElement, MaterialSymbolProps>(
    function MaterialSymbol(
      {
        size = 24,
        strokeWidth: _strokeWidth,
        absoluteStrokeWidth: _absoluteStrokeWidth,
        fill,
        className,
        style,
        title,
        role,
        ...props
      },
      ref,
    ) {
      void _strokeWidth;
      void _absoluteStrokeWidth;
      const cssSize = normaliseSize(size);
      const hasAccessibleName = Boolean(props["aria-label"] || title);
      const isFilled = fill !== undefined && fill !== "none" && fill !== "0";
      const symbolStyle: MaterialSymbolStyle = {
        width: cssSize,
        height: cssSize,
        ...(fill !== undefined
          ? { "--material-symbol-fill": isFilled ? 1 : 0 }
          : null),
        ...style,
      };
      const paths = MATERIAL_SYMBOL_PATHS[symbol];

      return (
        <svg
          {...props}
          ref={ref}
          className={[
            "material-symbol",
            `material-symbol--${symbol}`,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={symbolStyle}
          role={role ?? (hasAccessibleName ? "img" : undefined)}
          aria-hidden={
            props["aria-hidden"] ?? (hasAccessibleName ? undefined : true)
          }
          viewBox={paths.viewBox}
          width={cssSize}
          height={cssSize}
          fill="currentColor"
          focusable="false"
          data-material-symbol={symbol}
        >
          {title ? <title>{title}</title> : null}
          <g className="material-symbol__outline">
            {paths.outline.map((path) => (
              <path key={path} d={path} />
            ))}
          </g>
          <g className="material-symbol__filled">
            {paths.filled.map((path) => (
              <path key={path} d={path} />
            ))}
          </g>
        </svg>
      );
    },
  );

  MaterialSymbol.displayName = `MaterialSymbol(${symbol})`;
  return MaterialSymbol;
}

export const MATERIAL_SYMBOL_NAMES = {
  AlertCircle: "error",
  AlertTriangle: "warning",
  ArrowLeft: "arrow_back",
  ArrowRight: "arrow_forward",
  Bold: "format_bold",
  BookOpen: "menu_book",
  Braces: "data_object",
  BrainCircuit: "neurology",
  ChartNoAxesCombined: "monitoring",
  Check: "check",
  ChevronDown: "keyboard_arrow_down",
  ChevronLeft: "chevron_left",
  ChevronUp: "keyboard_arrow_up",
  CircleHelp: "help",
  Clock3: "schedule",
  Code2: "code",
  Command: "keyboard_command_key",
  Computer: "computer",
  Copy: "content_copy",
  Download: "download",
  Ellipsis: "more_horiz",
  ExternalLink: "open_in_new",
  Eye: "visibility",
  FactCheck: "fact_check",
  FileArchive: "folder_zip",
  FileDown: "file_save",
  FilePlus2: "note_add",
  FileText: "description",
  FitScreen: "fit_screen",
  Folder: "folder",
  FolderOpen: "folder_open",
  FolderPlus: "create_new_folder",
  FormatClear: "format_clear",
  GitMerge: "merge",
  Globe2: "language",
  GripVertical: "drag_indicator",
  Hand: "pan_tool",
  Heading1: "format_h1",
  Heading2: "format_h2",
  Heading3: "format_h3",
  Heart: "favorite",
  Highlighter: "ink_highlighter",
  History: "history",
  Home: "home",
  ImagePlus: "add_photo_alternate",
  Info: "info",
  Italic: "format_italic",
  Keyboard: "keyboard",
  Library: "local_library",
  Link2: "link",
  List: "format_list_bulleted",
  ListOrdered: "format_list_numbered",
  ListTodo: "checklist",
  ListTree: "account_tree",
  LoaderCircle: "progress_activity",
  Lock: "lock",
  LockOpen: "lock_open",
  Fullscreen: "fullscreen",
  Maximize2: "open_in_full",
  MessageCircle: "chat_bubble",
  MessageSquareText: "chat",
  Minimize2: "close_fullscreen",
  Minus: "remove",
  Moon: "dark_mode",
  Move: "open_with",
  Network: "hub",
  Notes: "notes",
  NotebookPen: "edit_note",
  PanelLeftClose: "left_panel_close",
  PanelLeftOpen: "left_panel_open",
  PanelRightClose: "right_panel_close",
  PanelRightOpen: "right_panel_open",
  Palette: "palette",
  Pencil: "edit",
  PencilLine: "edit_note",
  Pin: "keep",
  Plus: "add",
  Printer: "print",
  Quote: "format_quote",
  Redo2: "redo",
  RefreshCw: "refresh",
  RotateCcw: "replay",
  Save: "save",
  Scan: "document_scanner",
  Search: "search",
  Send: "send",
  Settings2: "tune",
  Settings: "settings",
  Shield: "shield",
  ShieldCheck: "verified_user",
  Sparkles: "stars_2",
  Spellcheck: "spellcheck",
  Sun: "light_mode",
  Table2: "table",
  TextDecrease: "text_decrease",
  TextCursorInput: "text_fields",
  TextIncrease: "text_increase",
  Trash2: "delete",
  Undo2: "undo",
  Upgrade: "upgrade",
  Upload: "upload",
  ViewColumn: "view_column",
  Wand2: "wand_stars",
  Workflow: "account_tree",
  WindowMaximize: "crop_square",
  Wrench: "build",
  X: "close",
  ZoomIn: "zoom_in",
  ZoomOut: "zoom_out",
} as const;

export const AlertCircle = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.AlertCircle,
);
export const AlertTriangle = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.AlertTriangle,
);
export const ArrowLeft = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ArrowLeft);
export const ArrowRight = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ArrowRight);
export const Bold = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Bold);
export const BookOpen = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.BookOpen);
export const Braces = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Braces);
export const BrainCircuit = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.BrainCircuit,
);
export const ChartNoAxesCombined = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ChartNoAxesCombined,
);
export const Check = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Check);
export const ChevronDown = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ChevronDown,
);
export const ChevronLeft = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ChevronLeft,
);
export const ChevronUp = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ChevronUp);
export const CircleHelp = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.CircleHelp);
export const Clock3 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Clock3);
export const Code2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Code2);
export const Command = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Command);
export const Computer = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Computer);
export const Copy = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Copy);
export const Download = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Download);
export const Ellipsis = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Ellipsis);
export const ExternalLink = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ExternalLink,
);
export const Eye = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Eye);
export const FileArchive = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.FileArchive,
);
export const FileDown = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FileDown);
export const FilePlus2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FilePlus2);
export const FileText = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FileText);
export const FactCheck = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FactCheck);
export const FitScreen = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FitScreen);
export const Folder = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Folder);
export const FolderOpen = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FolderOpen);
export const FolderPlus = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.FolderPlus);
export const FormatClear = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.FormatClear,
);
export const GitMerge = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.GitMerge);
export const Globe2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Globe2);
export const GripVertical = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.GripVertical,
);
export const Hand = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Hand);
export const Heading1 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Heading1);
export const Heading2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Heading2);
export const Heading3 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Heading3);
export const Heart = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Heart);
export const Highlighter = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.Highlighter,
);
export const History = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.History);
export const Home = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Home);
export const ImagePlus = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ImagePlus);
export const Info = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Info);
export const Italic = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Italic);
export const Keyboard = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Keyboard);
export const Library = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Library);
export const Link2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Link2);
export const List = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.List);
export const ListOrdered = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ListOrdered,
);
export const ListTodo = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ListTodo);
export const ListTree = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ListTree);
export const LoaderCircle = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.LoaderCircle,
);
export const Lock = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Lock);
export const LockOpen = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.LockOpen);
export const Fullscreen = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Fullscreen);
export const Maximize2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Maximize2);
export const MessageCircle = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.MessageCircle,
);
export const MessageSquareText = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.MessageSquareText,
);
export const Minimize2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Minimize2);
export const Minus = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Minus);
export const Moon = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Moon);
export const Move = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Move);
export const Network = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Network);
export const Notes = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Notes);
export const NotebookPen = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.NotebookPen,
);
export const PanelLeftClose = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.PanelLeftClose,
);
export const PanelLeftOpen = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.PanelLeftOpen,
);
export const PanelRightClose = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.PanelRightClose,
);
export const PanelRightOpen = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.PanelRightOpen,
);
export const Palette = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Palette);
export const Pencil = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Pencil);
export const PencilLine = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.PencilLine);
export const Pin = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Pin);
export const Plus = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Plus);
export const Printer = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Printer);
export const Quote = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Quote);
export const Redo2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Redo2);
export const RefreshCw = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.RefreshCw);
export const RotateCcw = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.RotateCcw);
export const Save = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Save);
export const Scan = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Scan);
export const Search = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Search);
export const Send = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Send);
export const Settings2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Settings2);
export const Settings = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Settings);
export const Shield = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Shield);
export const ShieldCheck = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.ShieldCheck,
);
export const Sparkles = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Sparkles);
export const Spellcheck = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Spellcheck);
export const Sun = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Sun);
export const Table2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Table2);
export const TextDecrease = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.TextDecrease,
);
export const TextCursorInput = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.TextCursorInput,
);
export const TextIncrease = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.TextIncrease,
);
export const Trash2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Trash2);
export const Undo2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Undo2);
export const Upgrade = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Upgrade);
export const Upload = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Upload);
export const ViewColumn = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ViewColumn);
export const Wand2 = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Wand2);
export const Workflow = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Workflow);
export const WindowMaximize = makeMaterialSymbol(
  MATERIAL_SYMBOL_NAMES.WindowMaximize,
);
export const Wrench = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.Wrench);
export const X = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.X);
export const ZoomIn = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ZoomIn);
export const ZoomOut = makeMaterialSymbol(MATERIAL_SYMBOL_NAMES.ZoomOut);
