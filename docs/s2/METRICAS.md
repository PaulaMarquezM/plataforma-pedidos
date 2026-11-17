# S2 — Métricas de Pedidos

## Experimento

1. Petición A: `GET http://localhost:3000/reporte/bloqueante`
2. Petición B: `GET http://localhost:3000/health`, enviada enseguida, mientras A seguía esperando
3. Al terminar: `GET http://localhost:3000/metricas`

## Resultado de /health (visto por el cliente)

| Petición | Código de estado | Tiempo |
|---|---|---|
| `GET /reporte/bloqueante` | 200 OK | ~5007 ms |
| `GET /health` | 200 OK | **~4509 ms** |

## Respuesta completa de /metricas

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 1,
      "promedioMs": 5002,
      "maxMs": 5002,
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

## ¿Por qué el cliente y el interceptor miden distinto a /health, y qué fallo ve el cliente?

El interceptor solo empieza a contar cuando Express ejecuta `medirLatencia`, y eso no ocurre hasta que el hilo principal queda libre.
Mientras `/reporte/bloqueante` ocupa el event loop, la petición `/health` espera en la cola del sistema operativo sin que nadie la mida.
Cuando por fin se atiende, responde en menos de 1 ms, así que el interceptor registra 0 ms y ninguna petición lenta.
El cliente, en cambio, mide desde que envía hasta que recibe la respuesta, e incluye esa espera de ~4.5 s.
Por eso el cliente ve un fallo de rendimiento (latencia alta), no un error: recibe un `200 OK` correcto pero tarde, y el servidor no lo detecta.
