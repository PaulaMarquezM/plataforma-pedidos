import express, {Request, Response} from 'express';
import {randomUUID} from "node:crypto";
import { medirLatencia, resumenMetricas } from "./metricas";
import { generarReporte, generarReporteEnHilo } from "./reporte";
import { contarPrimosEnPool, estadoPool } from "./pool";
import { Worker } from "node:worker_threads";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 3000);
const INVENTARIO_URL = process.env.INVENTARIO_URL ?? 'http://localhost:3002';
const TIMEOUT = Number(process.env.TIMEOUT ?? 2000);

interface Pedido {
    id: string;
    sku: string;
    cantidad: number;
    creadoEn: string;
}

const pedidos: Pedido[] = [];
const app = express();
app.use(express.json());
app.use(medirLatencia);

app.get("/metricas", (_req: Request, res: Response) => {
    res.json(resumenMetricas());
});

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", servicio: "pedidos" });
});
app.get("/health/ready", async (_req: Request, res: Response) => {
    const inicio = performance.now();
    try {
        const r = await fetch(INVENTARIO_URL + "/health", { signal: AbortSignal.timeout(1000) });
        const ms = Math.round(performance.now() - inicio);
        if (!r.ok) {
               res.status(503).json({status: "no-listo", inventario: "respondio " + r.status, ms});
            return;
        }
         res.json({status: "listo", inventario: "ok", ms});
    }catch (error) {
        const ms = Math.round(performance.now() - inicio);
        const e = error as Error & {cause?: {code?: string}};
        const motivo = e.name === "TimeoutError"
            ? "Inventario no respondio en 1000ms"
            : "no se pudo conectar con inventario "+ (e.cause?.code ?? e.message);
        console.error("error al consultar inventario", motivo)
        res.status(503).json({status: "no-listo", inventario: motivo, ms});
    }
});

// Práctica guiada: reporte que congela al servicio (corre en el hilo principal).
app.get("/reporte/bloqueante", (_req: Request, res: Response) => {
    res.json({ modo: "bloqueante", ...generarReporte() });
});

// Arreglo: el mismo reporte en un hilo trabajador; el servicio sigue respondiendo.
app.get("/reporte/hilo", async (_req: Request, res: Response) => {
    try {
        res.json({ modo: "hilo-trabajador", ...(await generarReporteEnHilo()) });
    } catch (error) {
        res.status(500).json({ error: "falló el reporte", detalle: (error as Error).message });
    }
});

// Lee ?n= (por defecto 2 000 000).
function leerN(req: Request): number {
    const n = Number(req.query.n ?? 2000000);
    return Number.isInteger(n) && n > 1 ? n : 2000000;
}

// Un hilo por petición, sin límite.
app.get("/reporte/worker", (req: Request, res: Response) => {
    const worker = new Worker(path.join(__dirname, "worker-reporte.js"), { workerData: { n: leerN(req) } });
    worker.once("message", (r) => res.json({ modo: "worker", ...r }));
    worker.once("error", (e: Error) => res.status(500).json({ error: "falló el reporte", detalle: e.message }));
});

// Despachador con un número fijo de trabajadores y cola acotada.
app.get("/reporte/pool", async (req: Request, res: Response) => {
    try {
        res.json({ modo: "pool", ...(await contarPrimosEnPool(leerN(req))) });
    } catch (error) {
        const e = error as Error;
        if (e.name === "PoolLleno") {
            res.set("Retry-After", "1").status(503).json({ error: e.message, pool: estadoPool() });
            return;
        }
        res.status(500).json({ error: "falló el reporte", detalle: e.message });
    }
});

app.get("/pedidos", async(req: Request, res: Response)=>{
    res.json(pedidos);
});

app.post("/pedidos", async(req: Request, res: Response)=>{
    const {sku, cantidad} = req.body ?? {};
    if(typeof sku !== "string" || !Number.isInteger(cantidad) || cantidad <= 0){
        res.status(400).json({error: "sku y cantidad son requeridos"});
        return;
    }

    const inicio = performance.now();
    try{
        const r = await fetch(INVENTARIO_URL + "/stock/" + encodeURIComponent(sku) + "/reservar", { method: "POST",headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cantidad }),signal: AbortSignal.timeout(TIMEOUT),});
        if(r.status === 404){
            res.status(404).json({error: "sku no encontrado en inventario "+ sku});
        return;
        }
        if(r.status === 409){
            const detalle = await r.json();
            res.status(409).json(detalle);
            return;
        }
        if(!r.ok){
            res.status(502).json({error: "inventario respondió " + r.status});
            return;
        }
        const pedido: Pedido = {
            id: randomUUID(),
            sku,
            cantidad,
            creadoEn: new Date().toISOString()

        };
        pedidos.push(pedido);
        res.status(201).json(pedido);
    }catch(error){
        const durancionMS = Math.round(performance.now() - inicio);
        const e=error as Error & {cause?: {code?: string}};
        const motivo =e.name === "TimeoutError"
        ? "Inventario no respondio en "+ TIMEOUT + "ms"
        : "no se pudo conectar con inventario "+ (e.cause?.code ?? e.message);
        console.error("error al crear pedido", motivo)
        res.status(503).json({error:"inventario no disponible", motivo, durancionMS});

    }
});

app.listen(PORT,()=>{
    console.log("pedidos en puerto "+ PORT+ " inventario en "+ INVENTARIO_URL + " timeout en "+ TIMEOUT + "ms");
})