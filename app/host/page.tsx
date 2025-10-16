"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type CommandPayload = Record<string, unknown> | undefined;

type LogLevel = "info" | "error" | "state" | "ack";

type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  ts: number;
};

const DEFAULT_ACTIONS: {
  label: string;
  action: string;
  payload?: CommandPayload;
}[] = [
  { label: "Escena: Agenda", action: "setScene", payload: { name: "agenda" } },
  { label: "Escena: Oferta", action: "setScene", payload: { name: "offer" } },
  { label: "Tema: Claro", action: "theme", payload: { value: "light" } },
  { label: "Tema: Oscuro", action: "theme", payload: { value: "dark" } },
  {
    label: "Banner: “¡Sólo hoy!”",
    action: "showBanner",
    payload: { text: "¡Sólo hoy!", mode: "promo" },
  },
];

const MAX_LOG_ITEMS = 200;

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(ts);
}

export default function HostControlPage(): JSX.Element {
  const params = useSearchParams();
  const session = params.get("session") ?? undefined;
  const encodedWss = params.get("wss") ?? undefined;
  const wss = useMemo(
    () => (encodedWss ? decodeURIComponent(encodedWss) : undefined),
    [encodedWss],
  );

  const [status, setStatus] = useState<
    "idle" | "connecting" | "open" | "closed"
  >("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const attemptRef = useRef(0);

  const pushLog = useCallback((entry: Omit<LogEntry, "ts">) => {
    setLogs((prev) => {
      const next: LogEntry[] = [
        {
          ...entry,
          ts: Date.now(),
        },
        ...prev,
      ];

      if (next.length > MAX_LOG_ITEMS) {
        return next.slice(0, MAX_LOG_ITEMS);
      }

      return next;
    });
  }, []);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!wss) {
      pushLog({
        id: crypto.randomUUID(),
        level: "error",
        message: "Parámetro wss ausente",
      });
      setStatus("closed");

      return () => undefined;
    }
    if (!session) {
      pushLog({
        id: crypto.randomUUID(),
        level: "error",
        message: "Parámetro session ausente",
      });
      setStatus("closed");

      return () => undefined;
    }

    closingRef.current = false;
    let cancelled = false;
    let currentSocket: WebSocket | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      attemptRef.current += 1;
      const socket = new WebSocket(wss);

      currentSocket = socket;
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelled) return;
        clearRetryTimeout();
        setStatus("open");
        attemptRef.current = 0;
        pushLog({
          id: crypto.randomUUID(),
          level: "info",
          message: "Conexión establecida",
        });
      });

      socket.addEventListener("close", (event) => {
        if (cancelled) return;
        pushLog({
          id: crypto.randomUUID(),
          level: "error",
          message: `Socket cerrado (${event.code})`,
        });
        setStatus("closed");
        if (!closingRef.current) {
          const nextDelay = Math.min(
            30000,
            1000 * 2 ** Math.min(attemptRef.current, 6),
          );

          clearRetryTimeout();
          retryTimeoutRef.current = setTimeout(connect, nextDelay);
        }
      });

      socket.addEventListener("error", () => {
        pushLog({
          id: crypto.randomUUID(),
          level: "error",
          message: "Error en el socket",
        });
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data as string);

          if (payload.kind === "ack") {
            pushLog({
              id: payload.id,
              level: "ack",
              message: `ACK ${payload.ok ? "✔️" : "❌"} (${payload.id})`,
            });
          } else if (payload.kind === "state") {
            pushLog({
              id: crypto.randomUUID(),
              level: "state",
              message: `Estado: ${JSON.stringify(payload)}`,
            });
          }
        } catch (error) {
          pushLog({
            id: crypto.randomUUID(),
            level: "error",
            message: `Mensaje inválido: ${(error as Error).message}`,
          });
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      closingRef.current = true;
      clearRetryTimeout();
      currentSocket?.close();
      socketRef.current = null;
    };
  }, [clearRetryTimeout, pushLog, session, wss]);

  const sendCommand = useCallback(
    (action: string, payload?: CommandPayload) => {
      const socket = socketRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        pushLog({
          id: crypto.randomUUID(),
          level: "error",
          message: "Socket no conectado",
        });

        return;
      }
      if (!session) {
        pushLog({
          id: crypto.randomUUID(),
          level: "error",
          message: "Sesión no definida",
        });

        return;
      }

      const message = {
        v: 1,
        kind: "cmd" as const,
        id: crypto.randomUUID(),
        session,
        action,
        payload,
        ts: Date.now(),
      } satisfies CommandMessage;

      socket.send(JSON.stringify(message));
      pushLog({ id: message.id, level: "info", message: `Enviado: ${action}` });
    },
    [pushLog, session],
  );

  const handleReset = useCallback(() => {
    sendCommand("reset", {});
  }, [sendCommand]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-zinc-100">
          Panel de control
        </h1>
        <p className="text-sm text-zinc-400">
          Sesión{" "}
          <span className="font-mono text-zinc-200">{session ?? "—"}</span>
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-3 w-3 rounded-full ${
              status === "open"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-500"
            }`}
          />
          <span className="text-zinc-300">
            {status === "open" && "Conectado"}
            {status === "connecting" && "Conectando…"}
            {status === "closed" && "Desconectado"}
            {status === "idle" && "Esperando"}
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {DEFAULT_ACTIONS.map(({ label, action, payload }) => (
          <button
            key={action + label}
            className="rounded-xl bg-zinc-800 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
            type="button"
            onClick={() => sendCommand(action, payload)}
          >
            {label}
          </button>
        ))}
        <button
          className="rounded-xl border border-red-500/60 bg-red-900/20 px-4 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-red-900/40"
          type="button"
          onClick={handleReset}
        >
          Kill switch
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Eventos
        </h2>
        <div className="h-64 overflow-auto rounded-xl border border-zinc-800 bg-black/70 p-3 font-mono text-xs text-zinc-200">
          {logs.length === 0 && (
            <p className="text-zinc-500">Sin eventos aún.</p>
          )}
          {logs.map((entry) => (
            <div key={entry.id} className="flex gap-2">
              <span className="text-zinc-500">{formatTimestamp(entry.ts)}</span>
              <span
                className={
                  entry.level === "error"
                    ? "text-red-400"
                    : entry.level === "ack"
                      ? "text-emerald-400"
                      : entry.level === "state"
                        ? "text-sky-400"
                        : "text-zinc-100"
                }
              >
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

type CommandMessage = {
  v: number;
  kind: "cmd";
  id: string;
  session: string;
  action: string;
  payload?: CommandPayload;
  ts: number;
};
