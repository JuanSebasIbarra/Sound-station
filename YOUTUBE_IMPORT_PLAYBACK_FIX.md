# Sound-Station - YouTube Import and Playback Fix

## Guia completa de migracion y reproduccion en TypeScript

---

## Tabla de contenidos

1. [Contexto y problemas](#1-contexto-y-problemas)
2. [Solucion de importacion](#2-solucion-de-importacion)
3. [Solucion de reproduccion](#3-solucion-de-reproduccion)
4. [Persistencia y cuota de almacenamiento](#4-persistencia-y-cuota-de-almacenamiento)
5. [Archivos modificados](#5-archivos-modificados)
6. [Verificacion y testing](#6-verificacion-y-testing)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Contexto y problemas

### 1.1 Problema original de importacion

- El endpoint /api/youtube/playlist solo existia dentro del plugin de Vite en desarrollo.
- En hosting estatico devolvia error HTTP 500.
- El flujo dependia de YOUTUBE_API_KEY en el backend dev.

### 1.2 Problema de almacenamiento

- El estado completo se guardaba en localStorage bajo una sola clave.
- Con playlists grandes, aparecia QuotaExceededError al hacer setItem.

### 1.3 Solucion general aplicada

- Importacion: fetch directo desde navegador a Invidious y Piped, sin API key y sin backend.
- Reproduccion: se mantiene el Player actual con YouTube iframe API (sin cambios de arquitectura).
- Persistencia: estado principal migrado a IndexedDB, con fallback legacy en localStorage.

---

## 2. Solucion de importacion

### 2.1 Enfoque

- Se reemplazo por completo el importador de YouTube.
- Se prueban varias instancias de Invidious.
- Si Invidious falla, se hace fallback automatico a Piped.
- Se aplica timeout por request para evitar bloqueos.

### 2.2 Resultado tecnico

- Sin dependencia de /api/youtube.
- Sin YOUTUBE_API_KEY.
- Compatible con despliegue estatico.

### 2.3 Notas de datos

- source se mantiene como youtube_music.
- audioUrl se guarda como videoId.
- El Player actual ya soporta extraer videoId desde ID o URL, por lo que no se requiere cambio obligatorio en el modelo actual.

---

## 3. Solucion de reproduccion

### 3.1 Estado real del proyecto

- No se introdujo un nuevo servicio de streams directos.
- El reproductor existente en src/core/Player.ts ya gestiona youtube_music usando iframe API de YouTube.
- Esto evita cambios grandes de arquitectura y mantiene la UI estable.

### 3.2 Flujo actual

1. Se importa playlist desde Invidious/Piped.
2. Se guardan canciones con source youtube_music.
3. Player detecta source youtube_music y ejecuta _playYouTubeSong.
4. Player crea/carga YT.Player y reproduce por videoId.

---

## 4. Persistencia y cuota de almacenamiento

### 4.1 Cambio aplicado

- El estado de app se mueve a IndexedDB en la base sound-station-app-db.
- Store principal: app-state.
- Key singleton: singleton.

### 4.2 Compatibilidad

- StorageService mantiene lectura legacy de localStorage.
- Si existe estado antiguo, se migra a IndexedDB al cargar.
- localStorage queda como respaldo minimo para compatibilidad.

### 4.3 Impacto

- Se elimina el bloqueo por cuota de localStorage para cargas grandes.
- Objetivo de 200-300 canciones queda cubierto, con margen superior en navegadores modernos.

---

## 5. Archivos modificados

## Importacion YouTube

- src/services/YouTubeMusicImporter.ts
- vite.config.ts

## Persistencia

- src/services/StorageService.ts
- src/services/PlaylistService.ts
- src/services/LibraryManager.ts
- src/main.ts

---

## 6. Verificacion y testing

### 6.1 Comandos

```bash
npm run type-check
npm run build
npm run dev
```

### 6.2 Prueba funcional recomendada

1. Abrir la app en desarrollo.
2. Importar una playlist de YouTube con 200-300 canciones.
3. Confirmar que no aparece QuotaExceededError.
4. Reproducir varias canciones youtube_music y validar avance/siguiente/anterior.

### 6.3 Resultado esperado

- Importacion exitosa con fallback entre instancias.
- Reproduccion funcional en Player para youtube_music.
- Persistencia estable sin fallos de cuota de localStorage.

---

## 7. Troubleshooting

### 7.1 Error 404 en /favicon.ico

- Es independiente de YouTube y almacenamiento.
- Solucion: agregar favicon en carpeta public para eliminar el warning.

### 7.2 Playlist no importa

- Verificar que la playlist sea publica.
- Reintentar: algunas instancias pueden estar lentas o caidas.

### 7.3 Cancion YouTube no reproduce

- Validar que audioUrl tenga videoId valido de 11 caracteres o URL valida.
- Revisar bloqueo de red, extensiones o politicas del navegador.

### 7.4 Datos antiguos inconsistentes

- Limpiar estado legacy si fue corrupto:

```javascript
localStorage.removeItem('sound-station.state.v3');
location.reload();
```

---

## Resumen

- Se elimino la dependencia de backend para YouTube.
- Se mantuvo el Player estable sin refactor mayor.
- Se migro persistencia principal a IndexedDB para soportar bibliotecas grandes.
- La app ahora es compatible con hosting estatico y cargas de playlists mas extensas.
