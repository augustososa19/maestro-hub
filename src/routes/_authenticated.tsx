import { useEffect, useState } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Moon,
  Music4,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useProfile } from "@/hooks/useMusicData";
import { initials, type LessonWithStudent, type Student } from "@/lib/domain";
import { ShellContext } from "@/components/app/shell-context";
import { LessonDialog, type LessonDraft } from "@/components/app/LessonDialog";
import { StudentDialog } from "@/components/app/StudentDialog";
import { ReportDialog } from "@/components/app/ReportDialog";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [lessonDraft, setLessonDraft] = useState<LessonDraft | null>(null);
  const [studentOpen, setStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [reportLesson, setReportLesson] = useState<LessonWithStudent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Music4 className="h-6 w-6 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  const api = {
    openLesson: (draft: LessonDraft) => setLessonDraft(draft),
    openStudent: (student?: Student | null) => {
      setEditingStudent(student ?? null);
      setStudentOpen(true);
    },
    openReport: (lesson: LessonWithStudent) => setReportLesson(lesson),
    openSearch: () => setSearchOpen(true),
  };

  return (
    <ShellContext.Provider value={api}>
      <div className="flex min-h-screen w-full bg-background">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <Brand />
          <NavList onNavigate={() => undefined} />
          <UserBox
            name={profile?.display_name ?? user.email ?? ""}
            email={user.email ?? ""}
            photo={profile?.photo_url ?? undefined}
            onSignOut={signOut}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
            <Sheet open={mobileNav} onOpenChange={setMobileNav}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Music4 className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-surface p-0">
                <Brand />
                <NavList onNavigate={() => setMobileNav(false)} />
                <UserBox
                  name={profile?.display_name ?? user.email ?? ""}
                  email={user.email ?? ""}
                  photo={profile?.photo_url ?? undefined}
                  onSignOut={signOut}
                />
              </SheetContent>
            </Sheet>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-ring sm:max-w-sm"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Buscar…</span>
              <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 text-[10px] sm:block">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Button size="sm" onClick={() => setLessonDraft({})}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova aula</span>
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>

      <LessonDialog draft={lessonDraft} onOpenChange={(o) => !o && setLessonDraft(null)} />
      <StudentDialog student={editingStudent} open={studentOpen} onOpenChange={setStudentOpen} />
      <ReportDialog lesson={reportLesson} onOpenChange={(o) => !o && setReportLesson(null)} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </ShellContext.Provider>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <Music4 className="h-4 w-4" />
      </span>
      <span className="truncate text-sm font-semibold tracking-tight">MusicCRM</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-0.5 p-3">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox({
  name,
  email,
  photo,
  onSignOut,
}: {
  name: string;
  email: string;
  photo?: string;
  onSignOut: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={photo} alt={name} />
          <AvatarFallback>{initials(name || email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name || "Professor"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
