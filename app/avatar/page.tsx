"use client";

import {
  Suspense,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

type SceneKey = "agenda" | "offer";
type ThemeKey = "light" | "dark" | string;

type BannerState = {
  text: string;
  mode?: "info" | "promo" | "warning";
};

type CommandMessage = {
  v: number;
  kind: "cmd";
  id: string;
  session: string;
  action: string;
  payload?: Record<string, unknown>;
  ts: number;
};

type AckMessage = {
  v?: number;
  kind: "ack";
  id: string;
  ok: boolean;
  ts: number;
  error?: string;
};

type StateMessage = {
  v: number;
  kind: "state";
  session: string;
  scene: SceneKey;
  theme: ThemeKey;
  banner?: BannerState | null;
  toggles: Record<string, boolean>;
  counters: Record<string, number>;
  text: Record<string, string>;
  ts: number;
};

type TextTarget = "#agenda-title" | "#offer-headline" | "#cta-message";
type CounterTarget = "#qa-count";

type SocketStatus = "connecting" | "open" | "closed";

const INITIAL_TEXT: Record<TextTarget, string> = {
  "#agenda-title": "Agenda del día",
  "#offer-headline": "Oferta exclusiva",
  "#cta-message": "Gracias por acompañarnos",
};

const INITIAL_COUNTERS: Record<CounterTarget, number> = {
  "#qa-count": 0,
};

const ALLOWED_TEXT_KEYS = new Set<TextTarget>([
  "#agenda-title",
  "#offer-headline",
  "#cta-message",
]);
const ALLOWED_COUNTERS = new Set<CounterTarget>(["#qa-count"]);

function AvatarPageContent(): ReactElement {
  const params = useSearchParams();
  const session = params.get("session") ?? undefined;
  const encodedWss = params.get("wss") ?? undefined;
  const wss = useMemo(
    () => (encodedWss ? decodeURIComponent(encodedWss) : undefined),
    [encodedWss],
  );

  const socketRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const shouldEmitStateRef = useRef(false);

  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [scene, setScene] = useState<SceneKey>("agenda");
  const [theme, setTheme] = useState<ThemeKey>("light");
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    highlight: true,
  });
  const [counters, setCounters] = useState<Record<string, number>>(() => ({
    ...INITIAL_COUNTERS,
  }));
  const [textValues, setTextValues] = useState<Record<TextTarget, string>>(
    () => ({ ...INITIAL_TEXT }),
  );

  const pushStateUpdate = useCallback(() => {
    shouldEmitStateRef.current = true;
  }, []);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const emitState = useCallback(() => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !session) {
      return;
    }

    const state: StateMessage = {
      v: 1,
      kind: "state",
      session,
      scene,
      theme,
      banner,
      toggles,
      counters,
      text: textValues,
      ts: Date.now(),
    };

    socket.send(JSON.stringify(state));
  }, [banner, counters, scene, session, textValues, theme, toggles]);

  useEffect(() => {
    if (!shouldEmitStateRef.current) return;
    shouldEmitStateRef.current = false;
    emitState();
  }, [emitState, scene, theme, banner, toggles, counters, textValues]);

  const sendAck = useCallback((id: string, ok: boolean, error?: string) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const ack: AckMessage = {
      v: 1,
      kind: "ack",
      id,
      ok,
      ts: Date.now(),
      error,
    };

    socket.send(JSON.stringify(ack));
  }, []);

  const applyAction = useCallback(
    (message: CommandMessage) => {
      const { action, payload } = message;

      switch (action) {
        case "setScene": {
          const name =
            typeof payload?.name === "string"
              ? (payload.name as SceneKey)
              : undefined;

          if (name && (name === "agenda" || name === "offer")) {
            setScene(name);
            pushStateUpdate();
          } else {
            throw new Error("Escena no soportada");
          }
          break;
        }
        case "theme": {
          const value =
            typeof payload?.value === "string"
              ? (payload.value as ThemeKey)
              : undefined;

          if (value) {
            setTheme(value);
            pushStateUpdate();
          }
          break;
        }
        case "showBanner": {
          const text = typeof payload?.text === "string" ? payload.text : "";

          if (!text) {
            setBanner(null);
          } else {
            const mode =
              typeof payload?.mode === "string"
                ? (payload.mode as BannerState["mode"])
                : "info";

            setBanner({ text, mode });
          }
          pushStateUpdate();
          break;
        }
        case "setText": {
          const selector = payload?.selector;
          const text = payload?.text;

          if (typeof selector === "string" && typeof text === "string") {
            if (!ALLOWED_TEXT_KEYS.has(selector as TextTarget)) {
              throw new Error("Selector no permitido");
            }
            setTextValues((prev) => ({
              ...prev,
              [selector as TextTarget]: text,
            }));
            pushStateUpdate();
          }
          break;
        }
        case "toggle": {
          const id = typeof payload?.id === "string" ? payload.id : undefined;
          const on = typeof payload?.on === "boolean" ? payload.on : undefined;

          if (!id || typeof on !== "boolean") {
            throw new Error("Toggle inválido");
          }
          setToggles((prev) => ({ ...prev, [id]: on }));
          pushStateUpdate();
          break;
        }
        case "counter": {
          const selector = payload?.selector;
          const delta = Number(payload?.delta ?? 0);

          if (
            typeof selector === "string" &&
            ALLOWED_COUNTERS.has(selector as CounterTarget)
          ) {
            setCounters((prev) => ({
              ...prev,
              [selector as CounterTarget]:
                (prev[selector as CounterTarget] ?? 0) + delta,
            }));
            pushStateUpdate();
          }
          break;
        }
        case "reset": {
          setScene("agenda");
          setTheme("light");
          setBanner(null);
          setTextValues(() => ({ ...INITIAL_TEXT }));
          setCounters(() => ({ ...INITIAL_COUNTERS }));
          setToggles({ highlight: true });
          pushStateUpdate();
          break;
        }
        case "play": {
          // Reservado para animaciones/sonidos en el futuro.
          break;
        }
        default:
          throw new Error(`Acción no soportada: ${action}`);
      }
    },
    [pushStateUpdate],
  );

  useEffect(() => {
    if (!wss || !session) {
      setSocketStatus("closed");

      return () => undefined;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setSocketStatus("connecting");
      attemptRef.current += 1;
      const socket = new WebSocket(wss);

      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelled) return;
        clearRetryTimeout();
        attemptRef.current = 0;
        setSocketStatus("open");
        emitState();
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as CommandMessage;

          if (message.kind !== "cmd") {
            return;
          }
          try {
            applyAction(message);
            sendAck(message.id, true);
          } catch (error) {
            sendAck(message.id, false, (error as Error).message);
          }
        } catch (error) {
          console.error("Mensaje inválido", error);
        }
      });

      socket.addEventListener("close", (event) => {
        if (cancelled) return;
        setSocketStatus("closed");
        const nextDelay = Math.min(
          30000,
          1000 * 2 ** Math.min(attemptRef.current, 6),
        );

        clearRetryTimeout();
        retryTimeoutRef.current = setTimeout(connect, nextDelay);

        console.warn("Socket cerrado", event.code);
      });

      socket.addEventListener("error", (event) => {
        console.error("Error de socket", event);
      });
    };

    connect();

    return () => {
      cancelled = true;
      clearRetryTimeout();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [applyAction, clearRetryTimeout, emitState, sendAck, session, wss]);

  const themeClasses =
    theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900";
  const highlightClass = toggles.highlight ? "opacity-100" : "opacity-50";

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <main
        className={`relative flex h-[720px] w-[1280px] flex-col overflow-hidden rounded-[32px] border border-zinc-800 shadow-2xl transition-colors duration-300 ${themeClasses}`}
        data-theme={theme}
      >
        <header className="flex items-center justify-between px-12 py-10">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
              Canal A
            </p>
            <h1 className="mt-3 text-5xl font-semibold" id="agenda-title">
              {textValues["#agenda-title"]}
            </h1>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Estado
            </span>
            <span className="mt-2 flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  socketStatus === "open"
                    ? "bg-emerald-400"
                    : socketStatus === "connecting"
                      ? "bg-amber-400"
                      : "bg-rose-500"
                }`}
              />
              {socketStatus === "open"
                ? "En vivo"
                : socketStatus === "connecting"
                  ? "Reconectando…"
                  : "Sin conexión"}
            </span>
            <span className="mt-2 rounded-full border border-zinc-700 px-3 py-1 text-xs font-mono text-zinc-400">
              {session}
            </span>
          </div>
        </header>

        <section className="relative flex flex-1 flex-col gap-8 px-12 py-6">
          {scene === "agenda" && (
            <div
              className={`grid grid-cols-1 gap-6 text-lg sm:grid-cols-2 ${highlightClass}`}
            >
              <div className="rounded-3xl bg-zinc-900/40 p-6 shadow-lg backdrop-blur">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Bienvenida
                </h2>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  Repaso general del evento
                </p>
                <p className="mt-3 text-sm text-zinc-400">10 minutos</p>
              </div>
              <div className="rounded-3xl bg-zinc-900/40 p-6 shadow-lg backdrop-blur">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Demostración
                </h2>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  Producto en acción
                </p>
                <p className="mt-3 text-sm text-zinc-400">15 minutos</p>
              </div>
              <div className="rounded-3xl bg-zinc-900/40 p-6 shadow-lg backdrop-blur sm:col-span-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Preguntas y respuestas
                </h2>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-2xl font-semibold text-zinc-100">
                    Espacio abierto
                  </p>
                  <span className="rounded-2xl bg-emerald-500/10 px-4 py-2 font-mono text-emerald-300">
                    Q&A #{counters["#qa-count"] ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {scene === "offer" && (
            <div className="flex h-full flex-col justify-center gap-6">
              <div className="rounded-3xl bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-emerald-400/10 p-8 shadow-lg">
                <h2
                  className="text-4xl font-semibold text-sky-200"
                  id="offer-headline"
                >
                  {textValues["#offer-headline"]}
                </h2>
                <p className="mt-4 max-w-xl text-lg text-sky-100/90">
                  Lanza tu avatar interactivo hoy mismo y conecta tu contenido a
                  cualquier reunión con latencia mínima.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-sky-400/30 bg-sky-400/10 p-6 text-sky-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">
                    Tiempo de implementación
                  </p>
                  <p className="mt-2 text-3xl font-semibold">48h</p>
                </div>
                <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-emerald-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                    Disponibilidad
                  </p>
                  <p className="mt-2 text-3xl font-semibold">99.9%</p>
                </div>
                <div className="rounded-3xl border border-indigo-400/30 bg-indigo-400/10 p-6 text-indigo-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-300/80">
                    Soporte
                  </p>
                  <p className="mt-2 text-3xl font-semibold">24/7</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between px-12 py-8">
          <p className="text-xl font-semibold" id="cta-message">
            {textValues["#cta-message"]}
          </p>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Transmisión activa con Recall.ai
          </div>
        </footer>

        {banner && (
          <div
            className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-10 py-6 text-xl font-semibold text-white shadow-[0_-16px_40px_rgba(0,0,0,0.35)] ${
              banner.mode === "promo"
                ? "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500"
                : banner.mode === "warning"
                  ? "bg-gradient-to-r from-amber-500 to-red-500"
                  : "bg-gradient-to-r from-slate-900 to-zinc-800"
            }`}
          >
            <span>{banner.text}</span>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AvatarPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-neutral-500">Cargando avatar…</div>
      }
    >
      <AvatarPageContent />
    </Suspense>
  );
}
