# Plataforma de pedidos

Servicios **Pedidos** (puerto 3000) e **Inventario** (puerto 3002) en Express + TypeScript.

```bash
docker compose up -d --build
```

## Rutas de Pedidos

- `GET /health`, `GET /health/ready`
- `GET /pedidos`, `POST /pedidos`
- `GET /reporte/bloqueante`: reporte pesado en el hilo principal (congela el servicio)
- `GET /reporte/hilo`: el mismo reporte en un hilo trabajador
