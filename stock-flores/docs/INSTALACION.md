# Instalación paso a paso

Se hace **una sola vez**. Tarda unos 15 minutos. Hace falta una cuenta de Google (la del negocio o la de quien administra).

Hay tres partes:

1. **La planilla de Google con el servidor**: guarda el stock, las reservas, el historial y los usuarios.
2. **La app publicada en internet (Netlify)**: es la dirección que se abre en el celular y la compu.
3. **Instalar la app** en cada dispositivo.

---

## 1. Planilla y servidor (Google Sheets + Apps Script)

1. Entrá a <https://sheets.new> con la cuenta de Google que va a ser dueña de los datos. Ponele de nombre **Stock Flores**.
2. En la planilla: menú **Extensiones → Apps Script**. Se abre el editor de código en otra pestaña.
3. Borrá todo lo que hay en el archivo `Código.gs` y pegá **el contenido completo** de [`apps-script/StockFlores.gs`](../apps-script/StockFlores.gs).
   En GitHub: abrí el archivo y tocá el botón **Copy raw file** (el de dos hojitas, arriba a la derecha).
4. Guardá con el ícono del disquete (o Ctrl+S).
5. Volvé a la pestaña de la planilla y **recargala**. A los pocos segundos aparece un menú nuevo: **Stock Flores**.
6. Tocá **Stock Flores → Preparar planilla**. La primera vez Google pide permiso:
   - **Continuar** → elegí la cuenta.
   - Aparece "Google no verificó esta app": es normal, porque el script es tuyo. Tocá **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**.
   - El permiso es **solo sobre esta planilla** (no sobre el resto de tu Drive).
   - Después de autorizar, tocá otra vez **Stock Flores → Preparar planilla**.
7. Te pide el **email** y el **nombre** del primer usuario administrador (por ejemplo: el email de tu mamá y "Mamá").
   Al terminar muestra una **contraseña temporal**: anotala. La app pide cambiarla la primera vez que se entra.
8. Se crean las hojas **Productos** (con los 25 productos del catálogo, todos "sin cargar"), **Reservas**, **Movimientos** y **Usuarios**.
9. Volvé al editor de Apps Script: **Implementar → Nueva implementación**.
   - En "Seleccionar tipo" (el engranaje): **Aplicación web**.
   - Descripción: `Stock Flores`.
   - **Ejecutar como: Yo**.
   - **Quién tiene acceso: Cualquier usuario**. Esto no deja los datos abiertos: la app pide email y contraseña para todo.
   - **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

> Los vendedores **no** necesitan acceso a la planilla. No la compartas: todo pasa por la app.

## 2. Publicar la app (Netlify)

1. Entrá a <https://app.netlify.com> con tu cuenta (la misma que usás para Mi Inflación).
2. **Add new site → Import an existing project → GitHub** → elegí el repo **stock-flores**.
3. No cambies nada de la compilación: Netlify la toma de `netlify.toml`. Tocá **Deploy**.
4. Recomendado: **Site configuration → Environment variables → Add a variable**
   - Key: `VITE_API_URL`
   - Value: la URL `/exec` del paso 1.9
   - Después: **Deploys → Trigger deploy → Deploy site**.

   Así la dirección del servidor queda fija y nadie tiene que pegarla. Si no la configurás, la app la pide la primera vez que se abre en cada dispositivo.
5. Opcional: **Site configuration → Change site name** (por ejemplo `stock-flores-mama`) para que el link sea `https://stock-flores-mama.netlify.app`.

## 3. Instalar la app en cada dispositivo

Abrí el link de Netlify y entrá con email y contraseña. Después:

- **Android (Chrome)**: menú **⋮ → Instalar app** (o "Agregar a la pantalla principal").
- **iPhone / iPad**: abrilo en **Safari** → botón **Compartir** (cuadrado con flecha) → **Agregar a pantalla de inicio**.
- **Computadora (Chrome o Edge)**: el ícono de instalar que aparece a la derecha de la barra de direcciones.

En la app, **Más → Instalar la app** muestra estas mismas instrucciones según el dispositivo.

## 4. Crear los usuarios de los vendedores

En la app (como administrador): **Más → Usuarios → + Nuevo**. Elegí el rol:

- **Vende**: vende, reserva, entrega, cancela y carga ingresos.
- **Administra**: además hace descartes, conteos y correcciones, edita productos y maneja usuarios.

La app muestra una **contraseña temporal** para pasarle a la persona; al entrar la cambia por una propia.
Si alguien la olvida: **Usuarios → la persona → Restablecer contraseña**.

También se puede desde la planilla: **Stock Flores → Crear usuario** / **Restablecer contraseña**.

## 5. Cargar el stock inicial

Todos los productos arrancan **"Sin cargar"** (no es lo mismo que agotado). Tocá cada uno, contá las bandejas que hay y cargá el número (puede ser 0).

---

## Actualizar el servidor cuando cambie el código

1. Pegá de nuevo `apps-script/StockFlores.gs` completo en el editor de Apps Script y guardá.
2. **Implementar → Administrar implementaciones** → lápiz (editar) → **Versión: Nueva versión** → **Implementar**.

La URL no cambia. Si te salteás el paso 2, sigue corriendo la versión anterior.

## Cuidados

- **No edites las hojas a mano.** Tienen un aviso de protección. Si alguien lo hace igual, **Stock Flores → Revisar el stock contra el historial** muestra las diferencias. Se corrigen desde la app con un **conteo**.
- **Copias de seguridad**: Google guarda todas las versiones de la planilla (**Archivo → Historial de versiones**). También podés hacer **Archivo → Crear una copia** cada tanto.
- **Si cambiás de cuenta de Google**: la planilla y el script se pueden copiar a otra cuenta con **Archivo → Crear una copia**. Después hay que implementar de nuevo y actualizar `VITE_API_URL`.

## Cómo se comporta

- Cada operación tarda 1 a 3 segundos (lo que tarda Google en guardar).
- Los otros celulares ven los cambios en unos 20 segundos, o al instante si tocan el indicador **"Al día"** de arriba.
- Si se corta internet, la app muestra el último stock conocido pero **no deja registrar operaciones** hasta que vuelva la conexión. Si una operación queda en duda por un corte, tocá el botón de nuevo: el servidor reconoce el reintento y no la registra dos veces.
- Dos vendedores no pueden vender la misma bandeja: el servidor procesa las operaciones de a una.
