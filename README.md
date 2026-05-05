# oni-claude-api

API REST para OniClaude — Node.js + Express + TypeScript + PostgreSQL + Prisma.

## Requisitos

- Node.js 20+
- PostgreSQL corriendo en `localhost:5432`

## Setup

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Dependencias
npm install

# 3. Crear usuario y base de datos (solo la primera vez)
sudo -u postgres psql << 'SQL'
CREATE USER oniclaude WITH PASSWORD 'oniclaude';
CREATE DATABASE oniclaude OWNER oniclaude;
ALTER USER oniclaude CREATEDB;
SQL

# 4. Migración y dev
npx prisma migrate dev --name init
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor en modo desarrollo (hot reload) |
| `npm run build` | Compilar TypeScript → `dist/` |
| `npm start` | Correr build de producción |
| `npx prisma studio` | GUI para explorar la base de datos |

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registro |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | Sí | Logout |
| GET | `/api/auth/me` | Sí | Usuario actual |
| POST | `/api/rooms` | Sí | Crear sala |
| GET | `/api/rooms/:id` | Sí | Obtener sala |
| DELETE | `/api/rooms/:id` | Sí | Eliminar sala |
| POST | `/api/games` | Sí | Crear partida |
| GET | `/api/games/:id` | Sí | Obtener partida |
| PATCH | `/api/games/:id/start` | Sí | Iniciar partida |
| GET | `/api/rounds/:id` | Sí | Obtener ronda |
| POST | `/api/rounds/:id/guess` | Sí | Enviar respuesta |

## Deploy

Ver `render.yaml` — infraestructura lista para Render (web service + PostgreSQL).
