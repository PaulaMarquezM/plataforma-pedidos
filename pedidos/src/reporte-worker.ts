// Código que corre dentro del hilo trabajador.
import { parentPort, workerData } from "node:worker_threads";
import { generarReporte } from "./reporte";

parentPort?.postMessage(generarReporte(workerData.ms));
