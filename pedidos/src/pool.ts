// Despachador con un número fijo de trabajadores y una cola acotada.
import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";

const MAX_TRABAJADORES = Number(process.env.MAX_TRABAJADORES ?? os.availableParallelism());
const MAX_COLA = Number(process.env.MAX_COLA ?? MAX_TRABAJADORES * 2);
const ARCHIVO_WORKER = path.join(__dirname, "worker-reporte.js");

export interface ResultadoReporte {
  n: number;
  primos: number;
  ms: number;
}

interface Trabajo {
  n: number;
  resolve: (r: ResultadoReporte) => void;
  reject: (e: Error) => void;
}

const cola: Trabajo[] = [];
let activos = 0;
let rechazadas = 0;

export class PoolLleno extends Error {
  constructor() {
    super("pool lleno: " + MAX_TRABAJADORES + " trabajando y " + MAX_COLA + " en cola");
    this.name = "PoolLleno";
  }
}

export function contarPrimosEnPool(n: number): Promise<ResultadoReporte> {
  return new Promise((resolve, reject) => {
    if (activos < MAX_TRABAJADORES) {
      ejecutar({ n, resolve, reject });
    } else if (cola.length < MAX_COLA) {
      cola.push({ n, resolve, reject });
    } else {
      rechazadas++;
      reject(new PoolLleno());
    }
  });
}

function ejecutar(trabajo: Trabajo): void {
  activos++;
  const worker = new Worker(ARCHIVO_WORKER, { workerData: { n: trabajo.n } });
  let terminado = false;
  const terminar = () => {
    if (terminado) return;
    terminado = true;
    activos--;
    // el despachador toma el siguiente trabajo de la cola
    const siguiente = cola.shift();
    if (siguiente) ejecutar(siguiente);
  };
  worker.once("message", (r: ResultadoReporte) => {
    trabajo.resolve(r);
    terminar();
  });
  worker.once("error", (e: Error) => {
    trabajo.reject(e);
    terminar();
  });
  worker.once("exit", (codigo) => {
    if (codigo !== 0) trabajo.reject(new Error("el worker terminó con código " + codigo));
    terminar();
  });
}

export function estadoPool() {
  return {
    maxTrabajadores: MAX_TRABAJADORES,
    activos,
    enCola: cola.length,
    maxCola: MAX_COLA,
    rechazadas,
  };
}
