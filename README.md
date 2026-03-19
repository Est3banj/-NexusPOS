# NexusPOS

Sistema de Punto de Venta (POS) offline-first con React y TypeScript.

## Características

### Arquitectura
- **Offline-First**: Funciona sin conexión a internet
- **PWA**: Instalable como aplicación nativa
- **Sincronización**: Sync automático cuando hay conexión

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
- Sesiones seguras con tokens

## Tecnologías

### Frontend
- React 18 + TypeScript
- Vite (bundler)
- Dexie.js (IndexedDB)
- Workbox (Service Worker/PWA)
- Lucide Icons

### Backend
- Node.js + Express
- SQLite

## Instalación

```bash
# Clonar repositorio
git clone https://github.com/Est3banj/NexusPOS.git
cd NexusPOS

# Instalar dependencias
cd frontend && npm install
cd ../backend && npm install

# Ejecutar desarrollo
cd frontend && npm run dev
```

## Primeros Pasos

### 1. Configuración Inicial

Al ejecutar la aplicación por primera vez, apareceré la pantalla de configuración:

1. Ingresa un **nombre de usuario** (mínimo 3 caracteres)
2. Establece una **contraseña segura** (mínimo 6 caracteres)
3. Confirma la contraseña
4. Haz clic en "Crear Cuenta"

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
│   │   ├── db/           # Dexie.js y repositorios
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Páginas principales
│   │   ├── services/      # Servicios (auth, sync)
│   │   └── types/        # TypeScript interfaces
│   └── public/
└── backend/
    └── src/
        ├── routes/        # API endpoints
        ├── middleware/    # Express middleware
        └── db.js         # SQLite setup
```

## API Endpoints

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
- `POST /api/sync` - Sincronizar cambios

## Configuración

### Variables de Entorno (Backend)

```env
PORT=3001
DATABASE_URL=./database.sqlite
```

### Configuración de PWA

Edita `frontend/vite.config.ts` para ajustar:
- Nombre de la aplicación
- Íconos
- Tema de colores

## Seguridad

### Recomendaciones

1. **Contraseñas**: Usa contraseñas robustas (8+ caracteres, números, símbolos)
2. **Empleados**: Crea cuentas individuales para cada empleado
3. **Sesiones**: Cierra sesión cuando termines de usar
4. **Código de barras**: Úsalo para agilizar las ventas

### Limitaciones

- Contraseñas almacenadas en texto plano (para demo)
- JWT simple sin hash (para demo)
- Para producción: implementar hash bcrypt y JWT real

## Licencia

MIT
