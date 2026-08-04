import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FileText, Loader2, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll, useMaterials, useStudents } from "@/hooks/useMusicData";
import { removeFromMedia, signedUrlFor, uploadToMedia } from "@/lib/storage";
import { formatBytes, materialKindOf } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca · MusicCRM" },
      { name: "description", content: "Partituras, PDFs, áudios e vídeos organizados por aluno." },
      { property: "og:title", content: "Biblioteca · MusicCRM" },
      { property: "og:description", content: "Partituras, PDFs, áudios e vídeos organizados por aluno." },
    ],
  }),
  component: Library,
});

function Library() {
  const { user } = useAuth();
  const invalidate = useInvalidateAll();
  const { data: materials = [] } = useMaterials();
  const { data: students = [] } = useStudents();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState("geral");
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => !q || m.title.toLowerCase().includes(q));
  }, [materials, query]);

  const upload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const { path } = await uploadToMedia(file, user.id, "materiais");
      const { error } = await supabase.from("materials").insert({
        teacher_id: user.id,
        student_id: target === "geral" ? null : target,
        title: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        kind: materialKindOf(file.type),
      });
      if (error) throw error;
      toast.success("Material enviado.");
      invalidate();
    } catch {
      toast.error("Falha no envio do arquivo.");
    }
    setUploading(false);
  };

  const open = async (path: string) => {
    try {
      window.open(await signedUrlFor(path), "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  };

  const remove = async (id: string, path: string) => {
    await removeFromMedia(path);
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Material removido.");
    invalidate();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="mt-1 text-sm text-muted-foreground">Materiais gerais ou vinculados a um aluno.</p>
      </header>

      <div className="panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar material"
            className="pl-9"
          />
        </div>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="geral">Material geral</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          id="material"
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button asChild disabled={uploading} className="shrink-0">
          <label htmlFor="material" className="cursor-pointer">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar
          </label>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-muted-foreground">Nenhum material ainda.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((material) => (
            <li key={material.id} className="panel grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{material.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatBytes(material.size_bytes)} · {formatDate(material.created_at)}
                </p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {students.find((s) => s.id === material.student_id)?.name ?? "Geral"}
                </Badge>
              </div>
              <div className="flex shrink-0 flex-col">
                <Button variant="ghost" size="icon" aria-label="Abrir" onClick={() => open(material.storage_path)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  className="text-destructive"
                  onClick={() => remove(material.id, material.storage_path)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
