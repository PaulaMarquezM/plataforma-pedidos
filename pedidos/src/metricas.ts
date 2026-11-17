// Interceptor que mide cada petición (tarea en clase).
import { Request, Response, NextFunction } from "express";
import { monitorEventLoopDelay } from "node:perf_hooks";
import os from "node:os";
import { estadoPool } from "./pool";

// Retardo del bucle de eventos: lo mide un temporizador interno de Node,
// así que sí ve los bloqueos aunque ninguna petición pueda medirse.
const retardoBucle = monitorEventLoopDelay({ resolution: 10 });
retardoBucle.enable();
const aMs = (ns: number) => Math.round(ns / 1e6);

const UMBRAL_LENTA_MS = Number(process.env.UMBRAL_LENTA_MS ?? 1000);

interface Estadistica {
  peticiones: number;
  totalMs: number;
  maxMs: number;
  lentas: number;
}

const porRuta = new Map<string, Estadistica>();

export function medirLatencia(req: Request, res: Response, next: NextFunction): void {
  const inicio = performance.now();
  res.on("finish", () => {
    // TODO 1: calcula la duración en ms
    const ms = performance.now() - inicio;

    // TODO 2: busca la estadística de `${req.method} ${req.path}` (créala si no existe)
    const clave = `${req.method} ${req.path}`;
    const e = porRuta.get(clave) ?? { peticiones: 0, totalMs: 0, maxMs: 0, lentas: 0 };

    // TODO 3: actualiza peticiones, totalMs, maxMs y lentas (ms > UMBRAL_LENTA_MS)
    e.peticiones += 1;
    e.totalMs += ms;
    e.maxMs = Math.max(e.maxMs, ms);
    if (ms > UMBRAL_LENTA_MS) e.lentas += 1;
    porRuta.set(clave, e);
  });
  next(); // sin next(), la petición nunca llega a la ruta
}

export function resumenMetricas() {
  // TODO 4: devuelve { umbralLentaMs, rutas: [{ ruta, peticiones, promedioMs, maxMs, lentas }] }
  return {
    umbralLentaMs: UMBRAL_LENTA_MS,
    nucleos: os.availableParallelism(),
    bucle: {
      p50Ms: aMs(retardoBucle.percentile(50)),
      p99Ms: aMs(retardoBucle.percentile(99)),
      maxMs: aMs(retardoBucle.max),
    },
    pool: estadoPool(),
    rutas: [...porRuta].map(([ruta, e]) => ({
      ruta,
      peticiones: e.peticiones,
      promedioMs: Math.round(e.totalMs / e.peticiones),
      maxMs: Math.round(e.maxMs),
      lentas: e.lentas,
    })),
  };
}
