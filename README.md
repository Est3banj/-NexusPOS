# NexusPOS

Sistema de Punto de Venta (POS) offline-first con React, TypeScript y backend Node.js.

## Características

### Arquitectura
- **Offline-First**: Funciona sin conexión a internet
- **PWA**: Instalable como aplicación nativa
- **Sincronización**: Sync automático cuando hay conexión
- **Multi-Dispositivo**: Los usuarios se autentican contra el backend, permitiendo acceso desde cualquier dispositivo

### Funcionalidades

#### Panel de Administrador
- **Productos**: CRUD completo con imágenes, código de barras y costos
- **Reportes**: Resumen financiero mensual con métricas
- **Cierre de Caja**: Control de sesiones de caja con diferencia
- **Usuarios**: Gestión de empleados y permisos

#### Panel de Empleado
- **Productos**: Vista de catálogo disponible
- **Venta**: Punto de venta con carrito y múltiples métodos de pago
- **Historial**: Registro de ventas realizadas

### Seguridad
- Autenticación basada en roles (Admin/Empleado)
- Permisos diferenciados por rol
- Sesiones seguras con tokens JWT
- Contraseñas hasheadas en backend

## Tecnologías

### Frontend
- React 18 + TypeScript
- Vite (bundler)
- Dexie.js (IndexedDB para offline)
- Workbox (Service Worker/PWA)
- Lucide Icons

### Backend
- Node.js + Express
- SQLite (base de datos compartida)
- JWT para autenticación

## Instalación

### Desarrollo (modo separated)

```bash
# Clonar repositorio
git clone https://github.com/Est3banj/NexusPOS.git
cd NexusPOS

# Instalar dependencias del frontend
cd frontend && npm install

# Instalar dependencias del backend
cd ../backend && npm install

# Terminal 1: Iniciar backend (puerto 3001)
cd backend && npm run dev

# Terminal 2: Iniciar frontend (puerto 3000)
cd frontend && npm run dev
```

Accede a: http://localhost:3000

### Producción (backend sirve el frontend)

```bash
# Instalar dependencias
cd frontend && npm install
cd ../backend && npm install

# Build del frontend
cd frontend && npm run build

# Iniciar backend (sirve el frontend automáticamente)
cd ../backend && npm start
```

Accede a: http://localhost:3001

### Acceso desde otros dispositivos

Para acceder desde celulares o tablets en la misma red:

1. Averiguá tu IP local:
   ```bash
   # macOS
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Linux
   ip addr show | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Desde otro dispositivo, accede a:
   ```
   http://TU-IP-LOCAL:3001
   ```

**Nota:** El acceso a cámara (escáner de códigos) requiere HTTPS en producción. Para desarrollo local funciona con HTTP.

## Primeros Pasos

### 1. Iniciar Sesión / Registro

Al ejecutar la aplicación por primera vez, aparecerás en la pantalla de login:

1. Si no tienes cuenta, haz clic en **"Crear una cuenta"**
2. Completa el formulario:
   - Nombre de usuario (mínimo 3 caracteres)
   - Contraseña (mínimo 6 caracteres)
   - Confirma la contraseña
3. Haz clic en **"Crear Cuenta"**

Este será tu usuario **Administrador**.

### 2. Agregar Productos

1. Ve a **Productos**
2. Haz clic en **+ Agregar**
3. Completa los campos:
   - Nombre del producto
   - Categoría
   - Precio de venta
   - Costo (para calcular ganancias)
   - Stock inicial
   - Código de barras (opcional)
   - Imagen (opcional)
4. Guarda el producto

### 3. Registrar Empleados

1. Ve a **Usuarios**
2. Haz clic en **+ Agregar**
3. Completa los datos del empleado
4. Asigna el rol: **Empleado**

## Uso

### Para Empleados

1. Inicia sesión con tus credenciales
2. Ve a **Venta** para registrar ventas
3. Usa el **escáner de código de barras** o busca productos
4. Selecciona método de pago y completa la venta

### Para Administradores

1. Inicia sesión
2. Gestiona productos, reportes y caja desde las pestañas correspondientes
3. Administra usuarios desde **Usuarios**

## Estructura del Proyecto

```
nexuspos/
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── contexts/       # Contextos (Auth)
│   │   ├── config/        # Configuración de API
│   │   ├── db/            # Dexie.js y repositorios
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Páginas principales
│   │   ├── services/      # Servicios (auth, sync)
│   │   └── types/         # TypeScript interfaces
│   └── public/
└── backend/
    └── src/
        ├── routes/         # API endpoints
        ├── middleware/     # Express middleware
        ├── db.js          # SQLite setup
        └── server.js      # Entry point
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/validate` - Validar token

### Productos
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Ventas
- `GET /api/sales` - Listar ventas
- `POST /api/sales` - Crear venta
- `PUT /api/sales/:id` - Actualizar venta

### Sincronización
- `POST /api/sync/batch` - Sincronización batch
- `GET /api/sync/status` - Estado de sincronización

### Sistema
- `GET /api/health` - Health check

## Configuración

### Variables de Entorno (Backend)

```env
PORT=3001
HOST=0.0.0.0
DB_PATH=./data/pos.db
```

### Variables de Entorno (Frontend - Opcional)

```env
VITE_API_URL=http://localhost:3001
```

### Configuración de PWA

Edita `frontend/vite.config.ts` para ajustar:
- Nombre de la aplicación
- Íconos
- Tema de colores

## Permisos del Navegador

El sistema necesita los siguientes permisos:

| Permiso | Uso | Cómo solicitarlo |
|---------|-----|------------------|
| Cámara | Escáner de códigos de barras | Se pide automáticamente al usar el scanner |
| Audio | Sonido de beep al escanear | Se usa automáticamente |

### Habilitar permisos manualmente

Si el navegador no pide los permisos automáticamente:

**Chrome (Android):**
1. Toca el candado 🔒 en la barra de direcciones
2. Ve a "Configuración del sitio"
3. Habilita **Cámara**

**Safari (iOS):**
1. Ve a Ajustes > Safari
2. Busca "Cámaras y lectores de código QR"
3. Selecciona "Permitir"

## Seguridad

### Recomendaciones

1. **Contraseñas**: Usa contraseñas robustas (8+ caracteres, números, símbolos)
2. **Empleados**: Crea cuentas individuales para cada empleado
3. **Sesiones**: Cierra sesión cuando termines de usar
4. **Código de barras**: Úsalo para agilizar las ventas

### Limitaciones

- Contraseñas en texto plano en SQLite (para demo)
- Para producción: implementar hash bcrypt y JWT real
- Cámara requiere HTTPS en producción (excepto localhost)

## Licencia

MIT
