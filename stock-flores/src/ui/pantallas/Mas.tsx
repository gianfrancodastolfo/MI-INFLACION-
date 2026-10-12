import { useEffect, useState } from 'react';
import { Boton } from '../componentes';
import { useApp } from '../contexto';
import { haceCuanto } from '../formato';
import { navegar } from '../ruta';
import { NOMBRE_ROL } from './Usuarios';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

// El navegador avisa una sola vez que la app se puede instalar: lo guardamos para el botón.
let eventoInstalar: EventoInstalar | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
  });
}

function esIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function instalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function Mas({ alCambiarServidor }: { alCambiarServidor: () => void }) {
  const { sesion, esAdmin, sync, backend, cerrarSesion, refrescar } = useApp();
  const [puedeInstalar, setPuedeInstalar] = useState(!!eventoInstalar);
  useEffect(() => {
    const t = setInterval(() => setPuedeInstalar(!!eventoInstalar), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="titulo-pantalla">
        <h1>Más</h1>
      </div>
      <div className="tarjeta" style={{ marginBottom: 12 }}>
        <div className="renglon-titulo" style={{ fontSize: 19 }}>
          {sesion.usuario.nombre}
        </div>
        <div className="nota-suave">
          {sesion.usuario.email} · {NOMBRE_ROL[sesion.usuario.rol]}
        </div>
      </div>

      <div className="menu-lista">
        {esAdmin && (
          <>
            <Boton variante="borde" onClick={() => navegar('/productos')}>
              Productos (nombres, mínimos, datos)
            </Boton>
            <Boton variante="borde" onClick={() => navegar('/usuarios')}>
              Usuarios
            </Boton>
          </>
        )}
        {backend.modo === 'google' && (
          <Boton variante="borde" onClick={() => navegar('/clave')}>
            Cambiar mi contraseña
          </Boton>
        )}
        <Boton variante="borde" onClick={() => refrescar(true)}>
          Actualizar datos ahora
        </Boton>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Instalar la app</h2>
      <div className="tarjeta">
        {instalada() ? (
          <p>Ya estás usando la app instalada.</p>
        ) : puedeInstalar ? (
          <>
            <p>Instalala para abrirla desde el inicio como cualquier app.</p>
            <Boton
              variante="primario"
              className="ancho"
              onClick={async () => {
                await eventoInstalar?.prompt();
                eventoInstalar = null;
                setPuedeInstalar(false);
              }}
            >
              Instalar
            </Boton>
          </>
        ) : esIOS() ? (
          <p>
            En iPhone o iPad: abrila en <strong>Safari</strong>, tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha) y
            elegí <strong>“Agregar a pantalla de inicio”</strong>.
          </p>
        ) : (
          <p>
            En Android (Chrome): menú <strong>⋮</strong> → <strong>“Instalar app”</strong> o <strong>“Agregar a la pantalla principal”</strong>.
            En la compu (Chrome o Edge): el ícono de instalar a la derecha de la barra de direcciones.
          </p>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Conexión</h2>
      <div className="tarjeta">
        <p style={{ marginTop: 0 }}>
          {backend.modo === 'demo' ? 'Modo prueba (datos solo en este dispositivo).' : 'Conectada a la planilla de Google.'}
          <br />
          <span className="nota-suave">
            {sync.fase === 'error' ? sync.error : `Última actualización: ${haceCuanto(sync.ultima) || '—'}`}
          </span>
        </p>
        {backend.modo === 'demo' && (
          <Boton variante="borde" className="ancho" onClick={alCambiarServidor}>
            Salir del modo prueba
          </Boton>
        )}
      </div>

      <Boton variante="borde" className="ancho" style={{ marginTop: 24 }} onClick={() => cerrarSesion()}>
        Cerrar sesión
      </Boton>
    </>
  );
}
