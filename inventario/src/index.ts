import express, {Request, Response} from "express";

const PORT = Number (process.env.PORT ?? 3002);
const RETARDO_MS =Number(process.env.RETARDO_MS ?? 0);
const stock = new Map<string, number>([
['Laptop-14', 5],
['Iphone 18', 5],
['Ipad', 6],
['Apple Watch', 5],
['AirPods', 5],
['MOUSE-USB', 40],
]);
const esperar =(ms:number) => new Promise<void>((r)=>setTimeout(r,ms));
const app = express();

app.use(express.json());
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK' });
});
app.listen(PORT, () => {
    console.log(`Servidor de inventario escuchando en el puerto ${PORT} retraso ${RETARDO_MS} ms`);
});
app.get("/stock/:sku", async (req: Request<{ sku: string }>, res: Response) => {
if (RETARDO_MS > 0) await esperar(RETARDO_MS);
const disponible = stock.get(req.params.sku);
if (disponible == undefined){
    res.status(404).json({error:'Sku No encontrado'+ req.params.sku});
    return;
}
res.json({sku:req.params.sku, disponible});
})
app.post("/stock/:sku/reservar", async (req: Request<{ sku: string }>, res: Response) => {
    const sku = req.params.sku;
    const cantidad = req.body?.cantidad;
    if(!Number.isInteger(cantidad) || cantidad <= 0){
        res.status(400).json({error:'cantidad debe ser un entero positivo'});
        return;
    }
    if (RETARDO_MS > 0) await esperar(RETARDO_MS);
    const disponible = stock.get(sku);
    if (disponible == undefined){
        res.status(404).json({error:'Sku No encontrado '+ sku});
        return;
    }
    if (disponible < cantidad){
        res.status(409).json({error:'No hay stock suficiente para sku '+ sku, disponible, solicitado: cantidad});
        return;
    }
    const restante = disponible - cantidad;
    stock.set(sku, restante);
    res.json({sku, reservado:cantidad, restante});
});
