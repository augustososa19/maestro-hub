import type { LucideIcon } from "lucide-react";
import { AudioLines, File, FileText, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* PageHeader                                                          */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard                                                            */
/* ------------------------------------------------------------------ */

type StatTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const TONE_STYLES: Record<StatTone, { icon: string; accent: string }> = {
  primary: { icon: "bg-primary/10 text-primary", accent: "text-primary" },
  success: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    accent: "text-rose-600 dark:text-rose-400",
  },
  info: {
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },
  muted: { icon: "bg-accent text-accent-foreground", accent: "" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "panel group relative flex items-center gap-2.5 overflow-hidden p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-panel sm:gap-3 sm:p-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold leading-tight tabular-nums sm:text-2xl",
            s.accent,
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10",
          s.icon,
        )}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: "default" | "music" | "search" | "calendar" | "folder" | "check";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <EmptyIllustration variant={illustration ?? "default"} />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function EmptyIllustration({ variant }: { variant: string }) {
  const fill = "currentColor";
  return (
    <svg
      viewBox="0 0 120 90"
      className="h-24 w-32 text-muted-foreground/25"
      aria-hidden="true"
      fill="none"
    >
      {variant === "music" && (
        <>
          <circle cx="34" cy="58" r="16" fill={fill} opacity="0.35" />
          <circle cx="86" cy="52" r="16" fill={fill} opacity="0.35" />
          <path
            d="M46 56v-30l36-8v30"
            stroke={fill}
            strokeWidth="5"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <path
            d="M82 18l10-2M80 30l-8 2"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.4"
          />
        </>
      )}
      {variant === "calendar" && (
        <>
          <rect x="22" y="24" width="76" height="52" rx="8" stroke={fill} strokeWidth="5" />
          <path
            d="M22 42h76M38 16v12M82 16v12"
            stroke={fill}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="48" cy="58" r="5" fill={fill} opacity="0.5" />
          <circle cx="70" cy="58" r="5" fill={fill} opacity="0.5" />
        </>
      )}
      {variant === "folder" && (
        <>
          <path
            d="M18 30a8 8 0 0 1 8-8h20l8 8h40a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V30z"
            stroke={fill}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M18 52h84M52 40h40"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.4"
          />
        </>
      )}
      {variant === "check" && (
        <>
          <circle cx="60" cy="45" r="28" stroke={fill} strokeWidth="5" />
          <path
            d="M48 45l9 9 16-18"
            stroke={fill}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M40 74c6 6 20 6 40 0"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.4"
          />
        </>
      )}
      {variant === "search" && (
        <>
          <circle cx="52" cy="48" r="22" stroke={fill} strokeWidth="5" />
          <path d="M68 64l16 16" stroke={fill} strokeWidth="6" strokeLinecap="round" />
          <path
            d="M44 38l-4 10M36 56l8 4"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.4"
          />
        </>
      )}
      {(variant === "default" || variant === undefined) && (
        <>
          <rect x="26" y="20" width="68" height="50" rx="8" stroke={fill} strokeWidth="5" />
          <path
            d="M44 46h32M44 56h20"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M30 34c0-6 8-6 8 0 0 5-8 5-8 11M52 34c0-6 8-6 8 0 0 5-8 5-8 11"
            stroke={fill}
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.45"
          />
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* FileTypeIcon                                                        */
/* ------------------------------------------------------------------ */

export type FileKind = "pdf" | "imagem" | "video" | "audio" | "outro";

export function fileKindStyles(kind: FileKind) {
  switch (kind) {
    case "pdf":
      return { icon: FileText, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" };
    case "imagem":
      return { icon: ImageIcon, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
    case "video":
      return { icon: Video, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    case "audio":
      return { icon: AudioLines, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    default:
      return { icon: File, cls: "bg-accent text-accent-foreground" };
  }
}

export function FileTypeIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const { icon: Icon, cls } = fileKindStyles(kind);
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-200",
        cls,
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedControl                                                    */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedFilter — variante com estilo "pill" para filtros           */
/* ------------------------------------------------------------------ */

export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge                                                         */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, string> = {
  ativo: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pausado: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  inativo: "border-transparent bg-muted text-muted-foreground",
  agendada: "border-transparent bg-primary/15 text-primary",
  realizada: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelada: "border-transparent bg-muted text-muted-foreground line-through",
  remarcada: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  pago: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pendente: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  atrasado: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-400",
  receita: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  despesa: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export function StatusBadge({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATUS_STYLES[value] ?? "border-transparent bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
