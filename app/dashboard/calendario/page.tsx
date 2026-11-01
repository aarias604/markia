"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { PostCard } from "@/components/posts/PostCard";
import { InlineLoader } from "@/components/ui/Loader";
import { STATUS_INFO, dayKey } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import type { Post, PostStatus } from "@/lib/types";
import { btnGold, cardCls, errorCls } from "@/lib/ui";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DOT: Record<PostStatus, string> = {
  draft: "bg-stone-400",
  scheduled: "bg-[#6B21A8]",
  publishing: "bg-amber-500",
  published: "bg-emerald-600",
  failed: "bg-red-600",
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "numeric", minute: "2-digit" });
}

export default function CalendarioPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setPosts((data as Post[]) ?? []);
      });
  }, []);

  const days = useMemo(() => {
    const offset = (cursor.getDay() + 6) % 7; // semana empieza en lunes
    return Array.from({ length: 42 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset + i));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts ?? []) {
      if (!p.scheduled_at) continue;
      const key = dayKey(new Date(p.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
    return map;
  }, [posts]);

  const drafts = (posts ?? []).filter((p) => !p.scheduled_at);
  const todayKey = dayKey(new Date());

  function replace(updated: Post) {
    setPosts((ps) => (ps ?? []).map((p) => (p.id === updated.id ? updated : p)));
    setSelected((s) => (s?.id === updated.id ? updated : s));
  }

  async function moveTo(postId: string, day: Date | null) {
    const post = posts?.find((p) => p.id === postId);
    if (!post) return;
    let patch: Partial<Post>;
    if (day) {
      const prev = post.scheduled_at ? new Date(post.scheduled_at) : null;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), prev ? prev.getHours() : 10, prev ? prev.getMinutes() : 0);
      patch = { scheduled_at: at.toISOString(), status: post.status === "published" ? "published" : "scheduled" };
    } else {
      patch = { scheduled_at: null, status: "draft" };
    }
    replace({ ...post, ...patch }); // se ve el cambio al instante
    const { data, error } = await createClient().from("posts").update(patch).eq("id", postId).select("*").single();
    if (error) {
      setError(`No se pudo mover: ${error.message}`);
      replace(post);
    } else replace(data as Post);
  }

  function onDrop(e: DragEvent, day: Date | null) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id) void moveTo(id, day);
  }

  const chip = (p: Post, showTime: boolean) => (
    <button
      key={p.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
      onClick={() => setSelected(p)}
      className="flex w-full items-center gap-1.5 truncate rounded-md bg-white px-1.5 py-1 text-left text-[11px] shadow-sm ring-1 ring-black/5 hover:ring-[#6B21A8]/40"
      title={p.title ?? ""}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[p.status]}`} />
      {showTime && p.scheduled_at && <span className="shrink-0 font-semibold">{timeLabel(p.scheduled_at)}</span>}
      <span className="truncate">{p.title || p.image_headline || "Publicación"}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="mt-1 text-sm text-[#4A154B]/70">Arrastra cada publicación al día que quieras. Toca una para editarla.</p>
        </div>
        <Link href="/dashboard/generador" className={btnGold}>
          <Sparkles className="h-4 w-4" /> Generar más
        </Link>
      </div>

      {error && <p className={errorCls}>{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <section className={`${cardCls} p-3 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <button className="rounded-lg p-2 hover:bg-[#4A154B]/5" aria-label="Mes anterior"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold capitalize">
              {cursor.toLocaleDateString("es-PA", { month: "long", year: "numeric" })}
            </h2>
            <button className="rounded-lg p-2 hover:bg-[#4A154B]/5" aria-label="Mes siguiente"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {posts === null ? (
            <InlineLoader />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-1 text-center text-xs font-semibold text-[#4A154B]/60">{d}</div>
              ))}
              {days.map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const list = byDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                    onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                    onDrop={(e) => onDrop(e, d)}
                    className={`min-h-24 rounded-lg p-1 transition sm:min-h-28 ${
                      dragOver === key ? "bg-[#D9B382]/40" : inMonth ? "bg-[#FAF5EF]" : "bg-[#FAF5EF]/40 opacity-60"
                    }`}
                  >
                    <p className={`mb-1 text-right text-xs ${key === todayKey ? "font-bold text-[#8C338A]" : "text-[#4A154B]/60"}`}>
                      {key === todayKey ? <span className="rounded-full bg-[#8C338A] px-1.5 text-white">{d.getDate()}</span> : d.getDate()}
                    </p>
                    <div className="space-y-1">{list.map((p) => chip(p, true))}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#4A154B]/70">
            {(["draft", "scheduled", "published"] as PostStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {STATUS_INFO[s].label}
              </span>
            ))}
          </div>
        </section>

        <aside
          onDragOver={(e) => { e.preventDefault(); setDragOver("drafts"); }}
          onDragLeave={() => setDragOver((k) => (k === "drafts" ? null : k))}
          onDrop={(e) => onDrop(e, null)}
          className={`${cardCls} self-start ${dragOver === "drafts" ? "ring-2 ring-[#D9B382]" : ""}`}
        >
          <h2 className="font-bold">Sin fecha ({drafts.length})</h2>
          <p className="mb-3 text-xs text-[#4A154B]/60">Arrástralas al calendario. Suelta aquí para quitarle la fecha a una.</p>
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {drafts.length === 0 ? (
              <p className="text-sm text-[#4A154B]/50">Nada pendiente 🎉</p>
            ) : (
              drafts.map((p) => chip(p, false))
            )}
          </div>
        </aside>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#4A154B]/50 p-4 sm:p-8"
          onClick={() => setSelected(null)}>
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute -top-2 right-0 z-10 rounded-full bg-white p-2 shadow sm:-right-3" onClick={() => setSelected(null)}
              aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
            <PostCard
              key={selected.id + selected.scheduled_at}
              post={selected}
              onUpdated={replace}
              onDeleted={(id) => {
                setPosts((ps) => (ps ?? []).filter((p) => p.id !== id));
                setSelected(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
