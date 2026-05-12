# oni-claude-api

Backend de **OniClaude** — juego web multijugador de adivinar animes. Construido con Node.js + Express + TypeScript + PostgreSQL + Prisma + Socket.IO.

**Frontend:** https://github.com/IIC3585/tarea-2-claude-act-like-a-senior-dev

---

## Requisitos

- Node.js ≥ 20
- PostgreSQL corriendo localmente (o URL externa)
- npm ≥ 9

---

## Setup local

```bash
# 1. Clonar e instalar
git clone https://github.com/criism0/oni-claude-api
cd oni-claude-api
npm install

# 2. Variables de entorno
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/oniclaude
JWT_SECRET=cualquier_string_secreto_largo
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

```bash
# 3. Crear base de datos (primera vez)
sudo -u postgres psql << 'SQL'
CREATE USER oniclaude WITH PASSWORD 'oniclaude';
CREATE DATABASE oniclaude OWNER oniclaude;
ALTER USER oniclaude CREATEDB;
SQL

# 4. Migraciones
npx prisma migrate dev --name init

# 5. Levantar en desarrollo
npm run dev
# Corre en http://localhost:3000
```

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con hot reload (tsx watch) |
| `npm run build` | Compilar TypeScript → `dist/` |
| `npm start` | Correr build de producción |
| `npx prisma studio` | GUI para explorar la base de datos |
| `npx prisma migrate dev` | Aplicar migraciones pendientes |

---

## Endpoints REST

### Auth — `/api/auth` (público salvo indicación)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Crear usuario, setea cookie JWT |
| POST | `/api/auth/login` | No | Autenticar, setea cookie JWT |
| POST | `/api/auth/logout` | Sí | Invalida cookie |
| GET | `/api/auth/me` | Sí | Devuelve usuario autenticado |
| GET | `/api/auth/check-username` | Sí | Verifica disponibilidad de username |
| PATCH | `/api/auth/me` | Sí | Actualizar username y/o contraseña |

### Rooms — `/api/rooms` (requiere auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/rooms` | Crear sala, devuelve código único |
| GET | `/api/rooms/:id` | Obtener sala por ID |
| GET | `/api/rooms/code/:code` | Obtener sala por código de invitación |
| DELETE | `/api/rooms/:id` | Eliminar sala (solo owner) |

### Games — `/api/games` (requiere auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/games` | Crear partida para una sala |
| GET | `/api/games/me` | Historial de partidas FINISHED del usuario |
| GET | `/api/games/:id` | Obtener partida con rondas y puntajes |
| PATCH | `/api/games/:id/start` | Iniciar partida (solo owner de la sala) |

### Rounds — `/api/rounds` (requiere auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rounds/:id` | Obtener datos de una ronda |
| POST | `/api/rounds/:id/guess` | Enviar respuesta (validación fuzzy con fuzzball) |

### Animes — `/api/animes` (requiere auth, proxy a Shikimori)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/animes` | Listado de animes con filtros (género, año, score) |
| GET | `/api/animes/genres` | Géneros disponibles |
| GET | `/api/animes/:id/screenshots` | Screenshots de un anime |
| GET | `/api/animes/check` | Verificar disponibilidad de animes para el juego |

---

## Eventos WebSocket (Socket.IO)

La autenticación del socket se realiza mediante la misma cookie JWT. Todos los eventos de sala y juego requieren estar conectado.

### Cliente → Servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `room:join` | `{ roomId }` | Unirse a una sala |
| `room:leave` | `{ roomId }` | Salir de una sala |
| `game:start` | `{ gameId }` | Iniciar partida (solo owner) |
| `game:end` | `{ gameId }` | Terminar partida anticipadamente |
| `round:guess` | `{ roundId, guess }` | Enviar respuesta en una ronda |

### Servidor → Cliente

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `room:joined` | `{ userId, username }` | Un jugador se unió a la sala |
| `room:left` | `{ userId, username }` | Un jugador abandonó la sala |
| `room:players` | `{ players[] }` | Lista actualizada de jugadores |
| `room:full` | — | La sala está llena |
| `room:duplicate-session` | — | El usuario ya tiene una sesión activa en esta sala |
| `room:error` | `{ code }` | Error al unirse |
| `game:started` | `{ gameId }` | La partida comenzó |
| `game:ended` | `{ gameId, scores[] }` | La partida terminó con puntajes finales |
| `game:error` | `{ gameId }` | Error al iniciar la partida |
| `round:start` | `{ roundId, order, durationSec, totalRounds, imageUrl }` | Nueva ronda iniciada |
| `round:reveal` | `{ roundId, percent }` | Checkpoint de revelación de imagen (25/50/75/100%) |
| `round:hint` | `{ roundId, type, value, valueEnglish? }` | Nueva pista disponible |
| `round:correct` | `{ roundId, userId, username, points }` | Un jugador acertó |
| `round:incorrect` | `{ roundId }` | Respuesta incorrecta (solo al jugador) |
| `round:timeout` | `{ roundId, animeTitle }` | Tiempo agotado, se revela el anime |
| `score:update` | `{ scores[] }` | Ranking actualizado tras un acierto |

---

## Modelos de datos

```
User        — id, username, email, password, createdAt, updatedAt
Room        — id, code, name, maxPlayers, nRondas, duracionRonda, modoRevelacion, ownerId → User
Game        — id, roomId → Room, status (WAITING|IN_PROGRESS|FINISHED), startedAt, endedAt
Round       — id, gameId → Game, animeId, animeTitle, animeTitleEnglish, year, episodes, imageUrls[], order
Score       — id, userId, gameId, roundId, points, correct, guess  [unique: userId+roundId]
```

---

## Deploy

Ver `render.yaml` — infraestructura lista para Render (web service + PostgreSQL).

> **Build command en Render:**
> ```
> npm install && npx prisma generate && npm run build
> ```
