# Stock Flores

Herramienta **interna** para administrar el stock de flores comestibles y hojas especiales mientras se reciben pedidos y se vende. No es una tienda online.

- App instalable (PWA) para celular, navegador y computadora.
- Stock compartido entre todos los vendedores, guardado en una **planilla de Google** (con un servidor en Apps Script).
- Cada variedad tiene su propio stock, en **bandejas o envases completos**.
- Muestra **físico**, **reservado** y **disponible**, con indicadores de stock suficiente, bajo, agotado y **sin cargar** (que no es lo mismo que agotado).
- Ventas, reservas con entrega total o parcial, cancelaciones, ingresos de mercadería, descartes, conteos y correcciones.
- **Nada cambia el inventario sin dejar un movimiento en el historial**, con quién lo hizo y cuándo.

**Para ponerla en marcha: [docs/INSTALACION.md](docs/INSTALACION.md).**

## Reglas del negocio

| Operación | Físico | Reservado | Disponible | Quién |
| --- | --- | --- | --- | --- |
| Venta | − | | − | todos |
| Reserva | | + | − | todos |
| Cancelación de reserva | | − | + | todos |
| Entrega de reserva (puede ser parcial) | − lo entregado | − lo reservado | + lo no entregado | todos |
| Ingreso de mercadería | + | | + | todos |
| Stock inicial (solo si está "sin cargar") | = cantidad | | | todos |
| Descarte | − | | − | administra |
| Conteo de inventario | = lo contado | | | administra |
| Corrección (con motivo) | ± | | ± | administra |
| Editar datos del producto | | | | administra |

- No se puede vender ni reservar más de lo disponible. La reserva es "todo o nada": si un producto no alcanza, no se reserva ninguno.
- Una reserva se entrega o se cancela **una sola vez**. Al entregar se puede bajar la cantidad; lo no entregado vuelve a estar disponible.
- Un descarte puede dejar menos físico que lo reservado (la mercadería se perdió): la app lo marca como **"Faltan para reservas"**.
- Los productos tienen un **ID fijo**: renombrar no toca ventas, reservas ni historial (el historial muestra "antes X").
- El **vencimiento** se carga solo si se conoce (al ingresar mercadería o editando el producto). Se borra solo cuando el físico llega a 0. No hay control por lote en esta versión.
- Sin precios, costos ni facturación en esta versión.

Las reglas están en un solo lugar, [`src/core/reglas.ts`](src/core/reglas.ts), y las usan el servidor y el modo de prueba.

## Catálogo inicial

11 flores y 14 hojas, cada una con su stock (por ejemplo, caléndula naranja y amarilla son productos distintos). Las descripciones y las fotos salen de la lámina del negocio, sin agregados. "Flores c/tallo", "Primavera", "Coqueta" y "Conejito" tienen la nota **"Variedad a confirmar con el proveedor"**. Todo se puede editar desde **Más → Productos**.

## Desarrollo

Requiere Node 22.

```bash
npm ci
npm run dev        # http://localhost:5173 (sin servidor configurado: "Probar en modo prueba")
npm test           # reglas del negocio y servidor de Apps Script contra una planilla simulada
npm run build      # sitio estático en dist/ (Netlify)
npm run build:gas  # regenera apps-script/StockFlores.gs desde gas/ y src/core/
```

Si cambiás `src/core/` o `gas/`, corré `npm run build:gas` y commiteá `apps-script/StockFlores.gs` (CI verifica que esté al día).

## Estructura

```
src/core/          reglas del negocio (puras), tipos, catálogo inicial, indicadores
src/api/           conexión con el servidor de Google y modo de prueba (localStorage)
src/ui/            React: pantallas, componentes, estilos
gas/servidor.ts    servidor Apps Script: lee y escribe la planilla, sesiones, usuarios, menú
apps-script/       StockFlores.gs generado (es lo que se pega en Apps Script)
public/            manifest, service worker, íconos, fotos de productos
docs/              instalación
```

## Seguridad

- La aplicación web de Apps Script se ejecuta como la cuenta dueña de la planilla; el script solo tiene permiso sobre **esa** planilla (`@OnlyCurrentDoc`).
- Todo pide sesión, salvo el login. Contraseñas con sal y HMAC-SHA256 iterado. Sesiones firmadas de 90 días que se invalidan al cambiar la contraseña, el rol o al desactivar el usuario. Bloqueo de 15 minutos tras 5 intentos fallidos.
- Las operaciones se procesan de a una (bloqueo del script) y tienen un identificador: un reintento por un corte de conexión no se registra dos veces.
- Los textos se guardan de forma que la planilla nunca los interprete como fórmulas.
