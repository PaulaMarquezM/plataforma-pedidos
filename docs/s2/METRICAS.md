# S2 — Métricas de Pedidos

## Experimento (Postman, dos pestañas)

1. Petición A: `GET http://localhost:3000/reporte/bloqueante` (reporte configurado en 15 s con `REPORTE_MS=15000`)
2. Petición B: `GET http://localhost:3000/health`, enviada enseguida, mientras A seguía esperando
3. Al terminar: `GET http://localhost:3000/metricas`

## Resultado según Postman

| Petición | Código de estado | Tiempo (Postman) |
|---|---|---|
| `GET /reporte/bloqueante` | 200 OK | 15.01 s |
| `GET /health` | 200 OK | **10.88 s** |

## Respuesta completa de /metricas

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /metricas",
      "peticiones": 1,
      "promedioMs": 4,
      "maxMs": 4,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 1,
      "promedioMs": 15003,
      "maxMs": 15003,
      "lentas": 1
    },
    {
      "ruta": "GET /health",
      "peticiones": 1,
      "promedioMs": 0,
      "maxMs": 0,
      "lentas": 0
    }
  ]
}
```

## ¿Por qué Postman y el interceptor miden distinto a /health, y qué fallo ve el cliente?

El interceptor solo empieza a contar cuando Express ejecuta `medirLatencia`, y eso no ocurre hasta que el hilo principal queda libre.
Mientras `/reporte/bloqueante` ocupa el event loop, la petición `/health` espera en la cola sin que nadie la mida.
Cuando por fin se atiende, responde en menos de 1 ms, así que el interceptor registra 0 ms y ninguna petición lenta.
Postman, en cambio, mide desde que envía hasta que recibe la respuesta, e incluye esa espera: 10.88 s.
Por eso el cliente ve un fallo de rendimiento (latencia alta), no un error: recibe un `200 OK` correcto pero tarde, y el servidor no lo detecta.
