"use client";

import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { abandonUpload, finishUpload, startUpload } from "@/app/actions";
import { bytes } from "@/lib/when";
import { cn } from "../ui";

const ACCEPT = "video/mp4,video/quicktime,video/webm";

interface Item {
  key: string;
  name: string;
  size: number;
  progress: number;
  state: "uploading" | "done" | "error";
  error?: string;
}

interface UploaderApi {
  pick: () => void;
  upload: (files: FileList | File[]) => void;
  busy: boolean;
}

const Ctx = createContext<UploaderApi | null>(null);

export function useUploader(): UploaderApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUploader fuera de UploaderProvider");
  return v;
}

export function put(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`El storage respondió ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida"));
    xhr.send(file);
  });
}

export function UploaderProvider({ children, artistId = null }: { children: ReactNode; artistId?: string | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const uploadOne = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setItems((l) => [...l, { key, name: file.name, size: file.size, progress: 0, state: "uploading" }]);
      const r = await startUpload({ fileName: file.name, size: file.size, mimeType: file.type, artistId });
      if (!r.ok) return patch(key, { state: "error", error: r.error });
      try {
        await put(r.upload.url, r.upload.headers, file, (progress) => patch(key, { progress }));
      } catch (err) {
        await abandonUpload(r.videoId);
        return patch(key, { state: "error", error: err instanceof Error ? err.message : "Falló la subida" });
      }
      const done = await finishUpload(r.videoId);
      if (!done.ok) return patch(key, { state: "error", error: done.error });
      patch(key, { state: "done", progress: 1 });
      router.refresh();
      setTimeout(() => setItems((l) => l.filter((i) => i.key !== key)), 2500);
    },
    [artistId, router],
  );

  const upload = useCallback(
    (files: FileList | File[]) => {
      const list = [...files];
      const bad = list.filter((f) => !ACCEPT.split(",").includes(f.type));
      if (bad.length) toast.error(`${bad.map((f) => f.name).join(", ")}: subí MP4, MOV o WebM.`);
      // De a dos para no saturar la conexión.
      const ok = list.filter((f) => ACCEPT.split(",").includes(f.type));
      let i = 0;
      const next = async (): Promise<void> => {
        const f = ok[i++];
        if (!f) return;
        await uploadOne(f);
        return next();
      };
      void Promise.all([next(), next()]);
    },
    [uploadOne],
  );

  const api: UploaderApi = { pick: () => input.current?.click(), upload, busy: items.some((i) => i.state === "uploading") };

  return (
    <Ctx.Provider value={api}>
      {children}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="pointer-events-none fixed right-4 bottom-20 z-40 flex w-[320px] flex-col gap-2 md:bottom-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.div
              key={i.key}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pointer-events-auto overflow-hidden rounded-md border border-line-strong bg-ink-3/95 shadow-pop backdrop-blur"
            >
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {i.state === "done" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-ok" />
                ) : i.state === "error" ? (
                  <XCircle className="size-4 shrink-0 text-bad" />
                ) : (
                  <UploadCloud className="size-4 shrink-0 animate-pulse-soft text-orange" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{i.name}</div>
                  <div className={cn("truncate text-xs", i.state === "error" ? "text-bad" : "text-fg-3")}>
                    {i.state === "error" ? i.error : i.state === "done" ? "Listo, procesando en el worker" : `${Math.round(i.progress * 100)}% de ${bytes(i.size)}`}
                  </div>
                </div>
                {i.state === "error" && (
                  <button className="text-xs text-fg-3 hover:text-fg" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}>
                    Cerrar
                  </button>
                )}
              </div>
              {i.state === "uploading" && (
                <div className="h-0.5 bg-white/5">
                  <motion.div className="h-full bg-orange" animate={{ width: `${i.progress * 100}%` }} transition={{ ease: "easeOut" }} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

/** Zona para soltar archivos. */
export function DropZone({ children, className }: { children: ReactNode; className?: string }) {
  const { upload } = useUploader();
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn("relative", className)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        upload(e.dataTransfer.files);
      }}
    >
      {children}
      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-lg border border-dashed border-orange/70 bg-orange/[0.07] backdrop-blur-[1px]"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-fg">
              <UploadCloud className="size-5 text-orange" /> Soltá para subir a la biblioteca
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
