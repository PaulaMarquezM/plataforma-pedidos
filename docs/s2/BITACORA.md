# Bitácora · Arquitecturas y procesos · Paula Márquez

## Entorno
| Dato | Valor |
| --- | --- |
| Laptop (CPU, RAM) | MacBook con Apple M4 (10 núcleos), 16 GB de RAM; Docker Desktop con 10 CPU y 7.7 GB asignados |
| nucleos según /metricas | 10 |
| MAX_TRABAJADORES y MAX_COLA | 10 y 20 (valores por defecto: `os.availableParallelism()` y el doble) |
| Duración de un reporte con n=2000000 | ~200 ms (197 ms en el pool, 198 ms en `/reporte/worker`, sin carga) |

## 1. Resultados
| Escenario | Latencia 50 % | Latencia máx. | Respuestas 2xx | Respuestas 503 | Timeouts | bucle.maxMs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · bloqueo (/health) | 1 ms | 5004 ms | 75 397 (todas) | 0 | 0 | 5021 |
| 2 · worker sin límite | 2263 ms | 3204 ms | 496 (todas) | 0 | 0 | 100 |
| 3 · pool con límite | 5 ms | 1723 ms | 444 | 67 021 | 0 | 28 |

En el escenario 1, `/reporte/bloqueante` se pidió dos veces mientras corría la carga (a los ~3 s y ~9 s), con `curl` desde otra terminal:

```
bloqueante 1: 200 5.018389s
bloqueante 2: 200 5.005590s
```

### Escenario 1 · bloqueo
`npx -y autocannon@8 -c 20 -d 15 http://localhost:3000/health`

```
Running 15s test @ http://localhost:3000/health
20 connections


┌─────────┬──────┬──────┬───────┬──────┬─────────┬──────────┬─────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev    │ Max     │
├─────────┼──────┼──────┼───────┼──────┼─────────┼──────────┼─────────┤
│ Latency │ 1 ms │ 1 ms │ 3 ms  │ 3 ms │ 3.57 ms │ 104.3 ms │ 5004 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴──────────┴─────────┘
┌───────────┬─────┬──────┬─────────┬────────┬─────────┬──────────┬─────────┐
│ Stat      │ 1%  │ 2.5% │ 50%     │ 97.5%  │ Avg     │ Stdev    │ Min     │
├───────────┼─────┼──────┼─────────┼────────┼─────────┼──────────┼─────────┤
│ Req/Sec   │ 0   │ 0    │ 21      │ 13,287 │ 5,025.2 │ 6,161.68 │ 21      │
├───────────┼─────┼──────┼─────────┼────────┼─────────┼──────────┼─────────┤
│ Bytes/Sec │ 0 B │ 0 B  │ 5.69 kB │ 3.6 MB │ 1.36 MB │ 1.67 MB  │ 5.69 kB │
└───────────┴─────┴──────┴─────────┴────────┴─────────┴──────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 15

75k requests in 15.02s, 20.4 MB read
```

`/metricas` al terminar:

```json
{
  "umbralLentaMs": 1000,
  "nucleos": 10,
  "bucle": {
    "p50Ms": 11,
    "p99Ms": 13,
    "maxMs": 5021
  },
  "pool": {
    "maxTrabajadores": 10,
    "activos": 0,
    "enCola": 0,
    "maxCola": 20,
    "rechazadas": 0
  },
  "rutas": [
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 2,
      "promedioMs": 5003,
      "maxMs": 5005,
      "lentas": 2
    },
    {
      "ruta": "GET /health",
      "peticiones": 75397,
      "promedioMs": 0,
      "maxMs": 3,
      "lentas": 0
    }
  ]
}
```

### Escenario 2 · un hilo por petición, sin límite
`npx -y autocannon@8 -c 50 -d 20 "http://localhost:3000/reporte/worker?n=2000000"`

```
Running 20s test @ http://localhost:3000/reporte/worker?n=2000000
50 connections


┌─────────┬────────┬─────────┬─────────┬─────────┬────────────┬───────────┬─────────┐
│ Stat    │ 2.5%   │ 50%     │ 97.5%   │ 99%     │ Avg        │ Stdev     │ Max     │
├─────────┼────────┼─────────┼─────────┼─────────┼────────────┼───────────┼─────────┤
│ Latency │ 672 ms │ 2263 ms │ 3025 ms │ 3124 ms │ 2122.79 ms │ 628.44 ms │ 3204 ms │
└─────────┴────────┴─────────┴─────────┴─────────┴────────────┴───────────┴─────────┘
┌───────────┬─────────┬─────────┬─────────┬───────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5% │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼───────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 4       │ 4       │ 22      │ 38    │ 22.3    │ 9.25    │ 4       │
├───────────┼─────────┼─────────┼─────────┼───────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 1.16 kB │ 1.16 kB │ 6.38 kB │ 11 kB │ 6.47 kB │ 2.68 kB │ 1.16 kB │
└───────────┴─────────┴─────────┴─────────┴───────┴─────────┴─────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

496 requests in 20.03s, 129 kB read
```

`/metricas` al terminar:

```json
{
  "umbralLentaMs": 1000,
  "nucleos": 10,
  "bucle": {
    "p50Ms": 11,
    "p99Ms": 27,
    "maxMs": 100
  },
  "pool": {
    "maxTrabajadores": 10,
    "activos": 0,
    "enCola": 0,
    "maxCola": 20,
    "rechazadas": 0
  },
  "rutas": [
    {
      "ruta": "GET /reporte/worker",
      "peticiones": 446,
      "promedioMs": 2105,
      "maxMs": 3188,
      "lentas": 412
    }
  ]
}
```

### Escenario 3 · pool con límite
`npx -y autocannon@8 -c 50 -d 20 "http://localhost:3000/reporte/pool?n=2000000"`

```
Running 20s test @ http://localhost:3000/reporte/pool?n=2000000
50 connections


┌─────────┬──────┬──────┬───────┬───────┬──────────┬───────────┬─────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg      │ Stdev     │ Max     │
├─────────┼──────┼──────┼───────┼───────┼──────────┼───────────┼─────────┤
│ Latency │ 1 ms │ 5 ms │ 15 ms │ 21 ms │ 14.03 ms │ 106.81 ms │ 1723 ms │
└─────────┴──────┴──────┴───────┴───────┴──────────┴───────────┴─────────┘
┌───────────┬────────┬────────┬─────────┬─────────┬──────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg      │ Stdev  │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼────────┼────────┤
│ Req/Sec   │ 1,656  │ 1,656  │ 3,397   │ 4,073   │ 3,373.55 │ 508.53 │ 1,656  │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼────────┼────────┤
│ Bytes/Sec │ 668 kB │ 668 kB │ 1.38 MB │ 1.65 MB │ 1.37 MB  │ 207 kB │ 667 kB │
└───────────┴────────┴────────┴─────────┴─────────┴──────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

444 2xx responses, 67021 non 2xx responses
68k requests in 20.02s, 27.3 MB read
```

`/metricas` al terminar:

```json
{
  "umbralLentaMs": 1000,
  "nucleos": 10,
  "bucle": {
    "p50Ms": 12,
    "p99Ms": 21,
    "maxMs": 28
  },
  "pool": {
    "maxTrabajadores": 10,
    "activos": 0,
    "enCola": 0,
    "maxCola": 20,
    "rechazadas": 67041
  },
  "rutas": [
    {
      "ruta": "GET /reporte/pool",
      "peticiones": 67485,
      "promedioMs": 9,
      "maxMs": 1718,
      "lentas": 425
    }
  ]
}
```

## 2. Análisis

**1. Escenario 1: `bucle.maxMs` frente al `maxMs` de `GET /health`.**
`bucle.maxMs` llegó a 5021 ms, pero en `rutas` el `maxMs` de `GET /health` fue solo 3 ms, aunque autocannon vio una latencia máxima de 5004 ms.
El interceptor solo empieza a medir cuando Express ejecuta `medirLatencia`. Mientras `/reporte/bloqueante` ocupa el hilo principal, las peticiones a `/health` esperan en el socket y nadie las cronometra; cuando por fin se atienden, responden en 0–3 ms.
`monitorEventLoopDelay`, en cambio, programa un temporizador cada 10 ms y mide cuánto se atrasa. Durante el bloqueo el temporizador no puede dispararse, y ese atraso (≈5 s) queda registrado.
Por eso el bucle ve el bloqueo y la métrica por ruta no: una mide el tiempo dentro del manejador, la otra mide si el proceso está libre para atender.

**2. Escenario 2: un hilo por petición, sin límite.**
Se completaron 496 peticiones en 20 s (446 registradas por el interceptor; la diferencia de 50 son las que seguían en curso cuando autocannon cortó) y hubo 0 timeouts.
Aun así, un reporte que tarda ~200 ms solo pasó a tener una latencia del 50 % de 2263 ms y máxima de 3204 ms, más de 10 veces peor; 412 de 446 fueron lentas (> 1000 ms).
Con 50 conexiones hay unos 50 workers a la vez compitiendo por 10 núcleos: cada uno recibe en promedio una quinta parte de CPU, y además crear un worker tiene un costo propio (un nuevo motor V8, memoria, arranque del módulo).
En mi máquina (10 núcleos) eso no alcanzó el timeout de 10 s de autocannon, pero en un equipo con 2–4 núcleos el mismo reparto multiplicaría la espera por 12–25 y aparecerían timeouts. Sin límite, más peticiones solo significan que todas terminan más tarde.

**3. Escenario 3: 2xx frente a 503, y 503 con Retry-After frente a timeout.**
Hubo 444 respuestas 2xx y 67 021 respuestas 503 (el pool contó 67 041 rechazadas). La latencia del 50 % fue 5 ms porque casi todas eran rechazos inmediatos.
El pool atendió más o menos el mismo trabajo útil que el escenario 2 (444 frente a 496), pero sin degradar a todas las peticiones: las aceptadas tardaron lo de un reporte y las demás se enteraron enseguida.
Un 503 inmediato con `Retry-After` es un fallo explícito y rápido (fail-fast): el cliente sabe al instante que la petición no se procesó, cuándo reintentar, y no gasta recursos esperando.
Un timeout es un fallo de omisión o de rendimiento: el cliente no recibe nada a tiempo y no sabe si el servidor está caído, lento o si la petición sí se procesó. Por eso se tiene que esperar el plazo completo y es riesgoso reintentar.

**4. autocannon ignora Retry-After.**
Como reintenta enseguida, las 50 conexiones generaron unas 3370 peticiones por segundo (68 k en 20 s) aunque solo ~22 por segundo podían atenderse.
El servidor gastó casi todo su tiempo en recibir, rechazar y registrar peticiones que no podía atender: el bucle subió a p99 = 21 ms y `maxMs` = 28 ms, y el contador de rechazadas llegó a 67 041. Es una pequeña tormenta de reintentos.
Un cliente bien diseñado debería respetar `Retry-After` (esperar al menos 1 s), usar backoff exponencial con jitter para no reintentar todos a la vez, poner un número máximo de reintentos y, si el 503 se repite, dejar de insistir por un tiempo (circuit breaker).

**5. Tres réplicas detrás de un balanceador.**
Cada réplica tiene sus propias métricas y su propia cola en memoria. `/metricas` mostraría solo los datos de la réplica que atendió esa petición, y cada vez podría salir una distinta, así que los números no representan el sistema completo.
En total podría haber hasta 3 × 10 = 30 reportes simultáneos (más 3 × 20 = 60 en cola), aunque cada réplica cree que el máximo es 10. Si las tres corren en la misma máquina de 10 núcleos, volvería la sobrecarga del escenario 2.
Cambiaría dos cosas: enviar las métricas a un sistema central (por ejemplo, Prometheus raspando cada réplica con una etiqueta por instancia) y sumar ahí; y usar una cola compartida (Redis/BullMQ o RabbitMQ) con un grupo de workers dimensionado para el total de núcleos, o al menos configurar `MAX_TRABAJADORES` por réplica como núcleos ÷ réplicas.

## 3. Problemas encontrados
- El proyecto local no tenía `/reporte/worker` ni `worker-reporte.ts`, así que los creé: `worker-reporte.ts` cuenta los primos hasta `n` (`primos.ts`) y `/reporte/worker` crea un worker por petición.
- TypeScript marcó `e` como `unknown` en los eventos `error` del worker; lo resolví tipando el parámetro como `Error`.
- En el escenario 1, el reporte bloqueante dura 5 s (`REPORTE_MS`). Para lanzarlo dos veces a tiempo mientras autocannon corría, usé `curl` desde otra terminal en lugar de Postman.
- En el escenario 2 no aparecieron timeouts: con 10 núcleos, la latencia máxima (3.2 s) no llegó al límite de 10 s de autocannon. Lo dejé anotado tal como salió.
- autocannon reporta 496 respuestas en el escenario 2 y el interceptor 446: las 50 restantes estaban en curso cuando terminó la prueba.

## 4. Uso declarado de IA
Usé Claude (Claude Code) como asistente para implementar `pool.ts`, el retardo del bucle en `metricas.ts` y las rutas `/reporte/worker` y `/reporte/pool`, para ejecutar los escenarios con autocannon y para redactar el borrador de esta bitácora. Revisé el código, los resultados y las respuestas del análisis antes de entregarlos; todos los datos provienen de mis propias mediciones.
