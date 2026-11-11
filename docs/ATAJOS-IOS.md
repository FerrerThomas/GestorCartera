# App en el iPhone: PWA + Atajos de iOS

Dos piezas:

1. **PWA**: la misma web, instalada en la pantalla de inicio. Se abre a
   pantalla completa, con ícono propio y funciona aunque la red esté lenta (el
   shell queda cacheado; los saldos y precios siempre vienen de la red).
2. **Atajos de iOS** que llaman a la edge function `quick-action` para cargar un
   gasto, un ingreso o una transferencia **sin abrir la app**: desde el widget de
   Atajos, el botón de Acción, el Centro de control o "Oye Siri, nuevo gasto".

---

## 1. Puesta en marcha (una sola vez)

### 1.1 Base de datos

En el SQL Editor de Supabase correr `supabase/migrations/006_movements.sql`.
Crea `categories` (con presupuesto mensual), `movements`, `api_tokens` y las
funciones `register_movement`, `delete_movement`, `seed_default_categories` y
`create_api_token`.

Cómo funciona el saldo: un movimiento **no** inventa un saldo aparte, sino que
escribe en el mismo ledger que ya usa el dashboard:

| Cuenta | Dónde vive el saldo | Qué hace un gasto |
|---|---|---|
| Billetera (Mercado Pago, etc.) | activo `SALDO` (kind `fund`) | baja `fund_value` + fila negativa en `asset_history` |
| Cualquier otra | activo `Efectivo` con ticker `ARS` o `USD` | fila negativa en `asset_history` |

Si la cuenta no tiene saldo suficiente, el movimiento se rechaza con un mensaje
claro (que el Atajo muestra como notificación).

### 1.2 Edge function

Dashboard → Edge Functions → **Deploy a new function** → nombre `quick-action`
→ pegar `supabase/functions/quick-action/index.ts`.

**Importante:** desactivar **"Enforce JWT verification"** en esa función (usa su
propio token, no la sesión de Supabase, porque la sesión vence cada hora y un
Atajo no la puede renovar). Por CLI sería:

```bash
supabase functions deploy quick-action --no-verify-jwt
```

### 1.3 Token personal

Cuando esté la pantalla **Ajustes → Atajos de iOS**, se genera desde ahí con un
botón. Mientras tanto, desde el SQL Editor (reemplazá el email):

```sql
with t as (select 'pa_' || encode(extensions.gen_random_bytes(24), 'hex') as tok),
ins as (
  insert into api_tokens (user_id, name, token_hash, token_hint)
  select u.id, 'iPhone', encode(extensions.digest(t.tok, 'sha256'), 'hex'), right(t.tok, 4)
  from auth.users u, t
  where u.email = 'TU_EMAIL_DE_LOGIN'
  returning id
)
select t.tok as token_copialo_ahora from t, ins;
```

Guardá el token (`pa_…`): en la base solo queda su hash. Para revocarlo:
`update api_tokens set revoked_at = now() where token_hint = 'xxxx';`

### 1.4 Probar desde la terminal

```bash
curl -s https://TU_REF.supabase.co/functions/v1/quick-action -H "Authorization: Bearer pa_TU_TOKEN"
```

```bash
curl -s -X POST https://TU_REF.supabase.co/functions/v1/quick-action -H "Authorization: Bearer pa_TU_TOKEN" -H "Content-Type: application/json" -d '{"type":"gasto","amount":"12.500","category":"Supermercado","account":"Mercado Pago","note":"Coto"}'
```

---

## 2. Instalar la PWA en el iPhone

1. Abrí la web en **Safari** (tiene que ser Safari).
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrila desde el ícono: se abre sin barra de Safari y con sesión propia, así
   que hay que loguearse una vez adentro.

---

## 3. Armar los Atajos

En todos los Atajos se repiten estos dos datos (conviene guardarlos en una
acción **Texto** al principio y reusarla):

- **URL:** `https://TU_REF.supabase.co/functions/v1/quick-action`
- **Header:** `Authorization` = `Bearer pa_TU_TOKEN`

### 3.1 "Nuevo gasto"

| # | Acción | Configuración |
|---|---|---|
| 1 | **Obtener contenido de URL** | URL de arriba · Método `GET` · Encabezado `Authorization` |
| 2 | **Obtener valor del diccionario** | Clave `expense_categories` de *Contenido de URL* |
| 3 | **Elegir de la lista** | Indicador: "¿En qué?" |
| 4 | **Obtener valor del diccionario** | Clave `accounts` de *Contenido de URL* (paso 1) |
| 5 | **Elegir de la lista** | Indicador: "¿Con qué pagaste?" |
| 6 | **Solicitar entrada** | Tipo **Número** · "¿Cuánto?" |
| 7 | **Obtener contenido de URL** | Método `POST` · Encabezado `Authorization` · Cuerpo **JSON**: `type` = `gasto`, `amount` = *Entrada proporcionada*, `category` = *Elemento elegido* (paso 3), `account` = *Elemento elegido* (paso 5) |
| 8 | **Obtener valor del diccionario** | Clave `message` |
| 9 | **Mostrar notificación** | *Valor del diccionario* |

Opcional: antes del paso 7, **Solicitar entrada** de texto "Nota" y mandarla
como `note`.

Para algo todavía más rápido podés borrar los pasos 4 y 5 y no mandar
`account`: se usa la primera billetera o cuenta de efectivo.

### 3.2 "Agregar saldo" (ingreso)

Igual que el anterior, pero con la clave `income_categories` en el paso 2 y
`type` = `ingreso`. La cuenta elegida es la que **recibe** la plata.

### 3.3 "Transferir"

| # | Acción | Configuración |
|---|---|---|
| 1 | Obtener contenido de URL | `GET`, como arriba |
| 2 | Obtener valor del diccionario | `accounts` |
| 3 | Elegir de la lista | "¿Desde?" |
| 4 | Elegir de la lista | "¿Hacia?" (sobre el mismo resultado del paso 2) |
| 5 | Solicitar entrada | Número · "¿Cuánto?" |
| 6 | Obtener contenido de URL | `POST` JSON: `type` = `transferencia`, `amount`, `account` = paso 3, `to_account` = paso 4 |
| 7–8 | Obtener valor `message` → Mostrar notificación | |

### 3.4 "¿Cuánto gasté?"

1. **Obtener contenido de URL** (`GET`).
2. **Obtener valor del diccionario** → `message`.
3. **Mostrar resultado** (o **Decir texto**, para Siri).

Devuelve algo como:

```
Gastaste $612.400 este mes
Patrimonio: $48.215.300
⚠️ Supermercado: te quedan $41.300
```

### 3.5 Dónde ponerlos

- **Widget de Atajos** en la pantalla de inicio o de bloqueo: mantener apretado → Editar → Agregar widget → Atajos.
- **Centro de control** (iOS 18+): Editar → Agregar control → Atajos.
- **Botón de Acción** (iPhone 15 Pro y posteriores): Configuración → Botón de Acción → Atajo.
- **Siri**: el nombre del Atajo es la frase ("Oye Siri, nuevo gasto").

---

## 4. Referencia del endpoint

`GET /functions/v1/quick-action`

```json
{
  "ok": true,
  "message": "Gastaste $612.400 este mes\n…",
  "accounts": ["Mercado Pago", "Efectivo"],
  "all_accounts": [{ "id": "…", "name": "IOL", "currency": "ARS", "type": "broker" }],
  "expense_categories": ["🍔 Comida", "🛒 Supermercado", "…"],
  "income_categories": ["💼 Sueldo", "…"],
  "summary": { "month_expenses": { "ARS": 612400, "USD": 0 }, "budgets": [] }
}
```

`accounts` lista solo billeteras y efectivo (si no hay ninguna, todas).

`POST /functions/v1/quick-action`

| Campo | Obligatorio | Valores |
|---|---|---|
| `type` | sí | `gasto` · `ingreso` · `transferencia` (o `expense` · `income` · `transfer`) |
| `amount` | sí | número o texto: `12500`, `"12.500,50"`, `"$ 12.500"` |
| `account` | no | nombre o id; default la primera billetera o efectivo. En `ingreso` es el destino |
| `to_account` | en transferencia | nombre o id |
| `category` | no | nombre, con o sin emoji (`"🍔 Comida"` o `"comida"`) |
| `note` | no | texto |
| `date` | no | `YYYY-MM-DD`, default hoy (Argentina) |
| `currency` | no | `ARS` · `USD`, default la moneda de la cuenta |

Siempre responde `{ ok, message }`. Los errores de validación vuelven con
HTTP 200 y `ok: false` para que el Atajo muestre igual el mensaje. Un token
inválido devuelve 401.
