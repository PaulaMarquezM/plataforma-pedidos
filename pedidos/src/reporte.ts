// Reporte pesado (práctica guiada): trabajo de CPU que tarda varios segundos.
import { Worker } from "node:worker_threads";
import path from "node:path";

export const REPORTE_MS = Number(process.env.REPORTE_MS ?? 5000);

// Cálculo intensivo de CPU: mantiene ocupado el hilo que lo ejecuta durante `ms`.
export function generarReporte(ms: number = REPORTE_MS) {
  const inicio = performance.now();
  let iteraciones = 0;
  let acumulado = 0;
  while (performance.now() - inicio < ms) {
    acumulado += Math.sqrt(iteraciones++);
  }
  return {
    iteraciones,
    acumulado: Math.round(acumulado),
    ms: Math.round(performance.now() - inicio),
  };
}

// Ejecuta el mismo cálculo en un hilo trabajador: el hilo principal queda libre.
export function generarReporteEnHilo(ms: number = REPORTE_MS): Promise<ReturnType<typeof generarReporte>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "reporte-worker.js"), { workerData: { ms } });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (codigo) => {
      if (codigo !== 0) reject(new Error("el hilo trabajador terminó con código " + codigo));
    });
  });
}
