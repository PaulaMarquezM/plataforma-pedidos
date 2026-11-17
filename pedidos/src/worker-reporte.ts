// Código que corre dentro de un worker: cuenta primos hasta n y devuelve el resultado.
import { parentPort, workerData } from "node:worker_threads";
import { contarPrimos } from "./primos";

const inicio = performance.now();
const primos = contarPrimos(workerData.n);
parentPort?.postMessage({ n: workerData.n, primos, ms: Math.round(performance.now() - inicio) });
