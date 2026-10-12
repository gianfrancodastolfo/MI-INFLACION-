/** @OnlyCurrentDoc */
// Stock Flores — servidor para Google Sheets.
// ARCHIVO GENERADO por scripts/build-gas.mjs desde gas/servidor.ts y src/core: no editar a mano.
// Instalación: ver docs/INSTALACION.md (pegar este archivo completo en Extensiones → Apps Script).

"use strict";
var StockFlores = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // gas/servidor.ts
  var servidor_exports = {};
  __export(servidor_exports, {
    VERSION_API: () => VERSION_API,
    doGet: () => doGet,
    doPost: () => doPost,
    menuCrearUsuario: () => menuCrearUsuario,
    menuRestablecerClave: () => menuRestablecerClave,
    menuRevisarConsistencia: () => menuRevisarConsistencia,
    onOpen: () => onOpen,
    prepararPlanilla: () => prepararPlanilla
  });

  // src/core/catalogo.ts
  var A_CONFIRMAR = "Variedad a confirmar con el proveedor.";
  var CATALOGO_INICIAL = [
    // Flores comestibles
    { id: "flores-c-tallo", nombre: "Flores c/tallo", categoria: "flores", descripcion: "Mix de flores comestibles con tallo. Usos: decoración de platos, ensaladas y tragos.", notas: A_CONFIRMAR },
    { id: "pensamiento", nombre: "Pensamiento", categoria: "flores", descripcion: "Sabor suave y textura delicada. Usos: tortas, cupcakes, ensaladas y postres." },
    { id: "calendula-naranja", nombre: "Caléndula naranja", categoria: "flores", descripcion: "Pétalos de sabor suave, color intenso. Usos: decoración, infusiones, ensaladas y platos salados." },
    { id: "violitas", nombre: "Violitas", categoria: "flores", descripcion: "Flores pequeñas y delicadas. Usos: postres, cocktails, ensaladas y decoración fina." },
    { id: "primavera", nombre: "Primavera", categoria: "flores", descripcion: "Flores de colores intensos. Usos: decoración de tortas, postres y ensaladas.", notas: A_CONFIRMAR },
    { id: "aleli", nombre: "Alelí", categoria: "flores", descripcion: "Flores aromáticas y coloridas. Usos: decoración de tortas, postres y platos gourmet." },
    { id: "violas", nombre: "Violas", categoria: "flores", descripcion: "Variedad similar al pensamiento, de sabor suave. Usos: postres, ensaladas y decoración." },
    { id: "coqueta", nombre: "Coqueta", categoria: "flores", descripcion: "Pétalos finos y delicados. Usos: decoración de postres y platos gourmet.", notas: A_CONFIRMAR },
    { id: "clavelina", nombre: "Clavelina", categoria: "flores", descripcion: "Flores pequeñas y con bordes dentados. Usos: decoración de pastelería, cócteles y ensaladas." },
    { id: "conejito", nombre: "Conejito", categoria: "flores", descripcion: "Flores de forma particular y color llamativo. Usos: decoración de tortas, postres y ensaladas.", notas: A_CONFIRMAR },
    { id: "calendula-amarilla", nombre: "Caléndula amarilla", categoria: "flores", descripcion: "Pétalos de sabor suave, color vibrante. Usos: decoración, infusiones, ensaladas y platos salados." },
    // Hojas y verdes comestibles
    { id: "rucula-selvatica", nombre: "Rúcula selvática", categoria: "hojas", descripcion: "Sabor intenso y ligeramente picante. Usos: ensaladas, pizzas, sándwiches y decoración." },
    { id: "mizuna-rojo", nombre: "Mizuna rojo", categoria: "hojas", descripcion: "Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración de platos." },
    { id: "mizuna-lima", nombre: "Mizuna lima", categoria: "hojas", descripcion: "Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración." },
    { id: "acedera-roja", nombre: "Acedera roja", categoria: "hojas", descripcion: "Sabor ácido y refrescante. Usos: ensaladas, salsas y decoración." },
    { id: "mizuna-verde", nombre: "Mizuna verde", categoria: "hojas", descripcion: "Hoja fina y rizada, sabor suave. Usos: ensaladas y decoración." },
    { id: "coclearia-berro", nombre: "Coclearia berro", categoria: "hojas", descripcion: "Sabor fresco y ligeramente picante. Usos: ensaladas, sándwiches y decoración." },
    { id: "espinaca", nombre: "Espinaca", categoria: "hojas", descripcion: "Sabor suave. Usos: ensaladas, salteados, tartas y guarniciones." },
    { id: "pacchoi", nombre: "Pacchoi", categoria: "hojas", descripcion: "Sabor suave y crujiente. Usos: salteados, sopas y bowls." },
    { id: "capiqui", nombre: "Capiquí", categoria: "hojas", descripcion: "Hoja tierna y suave. Usos: ensaladas y decoración." },
    { id: "kale-blanco", nombre: "Kale blanco", categoria: "hojas", descripcion: "Sabor suave. Usos: ensaladas y decoración." },
    { id: "acelga-roja", nombre: "Acelga roja", categoria: "hojas", descripcion: "Sabor suave. Usos: ensaladas, salteados y tartas." },
    { id: "tatsoi", nombre: "Tatsoi", categoria: "hojas", descripcion: "Sabor suave. Usos: salteados, sopas y ensaladas." },
    { id: "taco-de-reina", nombre: "Taco de reina", categoria: "hojas", descripcion: "Hoja tierna y decorativa. Usos: ensaladas y decoración." },
    { id: "kale-violeta", nombre: "Kale violeta", categoria: "hojas", descripcion: "Sabor suave. Usos: ensaladas y decoración." }
  ];
  function productosIniciales(ahora) {
    const orden = { flores: 0, hojas: 0 };
    return CATALOGO_INICIAL.map((s) => {
      var _a;
      return {
        id: s.id,
        nombre: s.nombre,
        categoria: s.categoria,
        unidad: "bandeja",
        descripcion: s.descripcion,
        fisico: 0,
        reservado: 0,
        minimo: 0,
        stockCargado: false,
        activo: true,
        orden: ++orden[s.categoria],
        notas: (_a = s.notas) != null ? _a : "",
        proveedor: "",
        sku: "",
        calidad: "",
        fechaIngreso: "",
        vencimiento: "",
        foto: `/fotos/${s.id}.webp`,
        actualizado: ahora
      };
    });
  }

  // src/core/util.ts
  function normalizar(texto2) {
    return texto2.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function slug(texto2) {
    return normalizar(texto2).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function disponible(p) {
    return p.fisico - p.reservado;
  }
  function unidades(n, unidad) {
    const palabra = unidad === "envase" ? Math.abs(n) === 1 ? "envase" : "envases" : Math.abs(n) === 1 ? "bandeja" : "bandejas";
    return `${n} ${palabra}`;
  }
  var FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
  function esFechaValida(s) {
    if (!FECHA_RE.test(s)) return false;
    const [a, m, d] = s.split("-").map(Number);
    const f = new Date(Date.UTC(a, m - 1, d));
    return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
  }

  // src/core/reglas.ts
  var ErrorNegocio = class extends Error {
    constructor(mensaje) {
      super(mensaje);
      this.name = "ErrorNegocio";
    }
  };
  var SOLO_ADMIN = /* @__PURE__ */ new Set([
    "descarte",
    "conteo",
    "correccion",
    "crear_producto",
    "editar_producto"
  ]);
  function requiereAdmin(tipo) {
    return SOLO_ADMIN.has(tipo);
  }
  var MAX_CANTIDAD = 1e4;
  var LIMITES = {
    nombre: 60,
    descripcion: 300,
    notas: 500,
    proveedor: 80,
    sku: 40,
    calidad: 300,
    foto: 500,
    cliente: 80,
    nota: 300
  };
  function texto(valor, campo, etiqueta) {
    if (valor === void 0 || valor === null) return "";
    if (typeof valor !== "string") throw new ErrorNegocio(`${etiqueta}: valor inválido.`);
    const t = valor.trim();
    if (t.length > LIMITES[campo]) throw new ErrorNegocio(`${etiqueta}: máximo ${LIMITES[campo]} caracteres.`);
    return t;
  }
  function fecha(valor, etiqueta) {
    if (valor === void 0 || valor === null || valor === "") return "";
    if (typeof valor !== "string" || !esFechaValida(valor)) throw new ErrorNegocio(`${etiqueta}: la fecha no es válida.`);
    return valor;
  }
  function entero(valor, { min, etiqueta }) {
    if (typeof valor !== "number" || !Number.isInteger(valor)) {
      throw new ErrorNegocio(`${etiqueta}: tiene que ser un número entero.`);
    }
    if (valor < min) {
      throw new ErrorNegocio(min > 0 ? `${etiqueta}: tiene que ser mayor que cero.` : `${etiqueta}: no puede ser negativa.`);
    }
    if (Math.abs(valor) > MAX_CANTIDAD) throw new ErrorNegocio(`${etiqueta}: el número es demasiado grande.`);
    return valor;
  }
  function ejecutar(cmd, datos, actor, op) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    if (!cmd || typeof cmd !== "object" || typeof cmd.tipo !== "string") throw new ErrorNegocio("Operación inválida.");
    if (requiereAdmin(cmd.tipo) && actor.rol !== "admin") {
      throw new ErrorNegocio("Esta operación solo la puede hacer un administrador.");
    }
    const originales = new Map(datos.productos.map((p) => [p.id, p]));
    const tocados = /* @__PURE__ */ new Map();
    const pedidosTocados = /* @__PURE__ */ new Map();
    const movimientos = [];
    function tocar(id) {
      const ya = tocados.get(id);
      if (ya) return ya;
      const original = originales.get(id);
      if (!original) throw new ErrorNegocio("No encontré ese producto. Actualizá la pantalla y probá de nuevo.");
      const copia = __spreadProps(__spreadValues({}, original), { actualizado: op.ahora });
      tocados.set(id, copia);
      return copia;
    }
    function ver(id) {
      var _a2;
      const p = typeof id === "string" ? (_a2 = tocados.get(id)) != null ? _a2 : originales.get(id) : void 0;
      if (!p) throw new ErrorNegocio("No encontré ese producto. Actualizá la pantalla y probá de nuevo.");
      return p;
    }
    function vendible(id) {
      const p = ver(id);
      if (!p.activo) throw new ErrorNegocio(`${p.nombre} está inactivo.`);
      if (!p.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p.nombre}.`);
      return p;
    }
    function mover(id, tipo, dFisico, dReservado, extra = {}) {
      var _a2, _b2, _c2, _d2, _e2;
      const p = tocar(id);
      dFisico = dFisico || 0;
      dReservado = dReservado || 0;
      p.fisico += dFisico;
      p.reservado += dReservado;
      if (p.fisico === 0 && dFisico < 0) p.vencimiento = "";
      movimientos.push({
        id: op.nuevoId(),
        opId: op.opId,
        fecha: op.ahora,
        usuario: actor.email,
        usuarioNombre: actor.nombre,
        tipo,
        productoId: p.id,
        productoNombre: p.nombre,
        dFisico,
        dReservado,
        fisico: p.fisico,
        reservado: p.reservado,
        pedidoId: (_b2 = (_a2 = extra.pedido) == null ? void 0 : _a2.id) != null ? _b2 : "",
        pedidoNumero: (_d2 = (_c2 = extra.pedido) == null ? void 0 : _c2.numero) != null ? _d2 : 0,
        nota: (_e2 = extra.nota) != null ? _e2 : ""
      });
      return p;
    }
    function pedidoPendiente(id) {
      const pedido = datos.pedidos.find((x) => x.id === id);
      if (!pedido) throw new ErrorNegocio("No encontré esa reserva. Actualizá la pantalla.");
      if (pedido.estado === "entregado") throw new ErrorNegocio(`La reserva #${pedido.numero} ya fue entregada.`);
      if (pedido.estado === "cancelado") throw new ErrorNegocio(`La reserva #${pedido.numero} ya fue cancelada.`);
      return pedido;
    }
    function aviso(p) {
      const d = disponible(p);
      return d < 0 ? ` Atención: faltan ${unidades(-d, p.unidad)} para cubrir las reservas de ${p.nombre}.` : "";
    }
    let mensaje = "";
    switch (cmd.tipo) {
      case "venta": {
        const p = vendible(cmd.productoId);
        const n = entero(cmd.cantidad, { min: 1, etiqueta: "Cantidad" });
        const d = disponible(p);
        if (d < n) {
          const reservadas = p.reservado > 0 ? ` (${unidades(p.reservado, p.unidad)} reservadas)` : "";
          throw new ErrorNegocio(
            d <= 0 ? `No hay ${p.nombre} disponible para vender${reservadas}.` : `Solo hay ${unidades(d, p.unidad)} de ${p.nombre} disponibles${reservadas}.`
          );
        }
        mover(p.id, "venta", -n, 0, { nota: texto(cmd.nota, "nota", "Nota") });
        mensaje = `Venta registrada: ${unidades(n, p.unidad)} de ${p.nombre}.`;
        break;
      }
      case "ingreso": {
        const p0 = ver(cmd.productoId);
        if (!p0.activo) throw new ErrorNegocio(`${p0.nombre} está inactivo. Activalo antes de cargar mercadería.`);
        const n = entero(cmd.cantidad, { min: 1, etiqueta: "Cantidad" });
        const fIngreso = fecha(cmd.fechaIngreso, "Fecha de ingreso") || op.hoy;
        const venc = fecha(cmd.vencimiento, "Vencimiento");
        const nota = [texto(cmd.nota, "nota", "Nota"), venc ? `Vence ${venc}` : ""].filter(Boolean).join(" · ");
        const p = tocar(p0.id);
        p.stockCargado = true;
        p.fechaIngreso = fIngreso;
        if (venc) p.vencimiento = venc;
        mover(p.id, "ingreso", n, 0, { nota });
        mensaje = `Ingreso registrado: +${unidades(n, p.unidad)} de ${p.nombre}.`;
        break;
      }
      case "stock_inicial": {
        const p0 = ver(cmd.productoId);
        if (p0.stockCargado) {
          throw new ErrorNegocio(`El stock de ${p0.nombre} ya está cargado. Para corregirlo, un administrador puede hacer un conteo.`);
        }
        const n = entero(cmd.cantidad, { min: 0, etiqueta: "Cantidad" });
        const fIngreso = fecha(cmd.fechaIngreso, "Fecha de ingreso");
        const venc = fecha(cmd.vencimiento, "Vencimiento");
        const p = tocar(p0.id);
        p.stockCargado = true;
        if (fIngreso) p.fechaIngreso = fIngreso;
        if (venc && n > 0) p.vencimiento = venc;
        mover(p.id, "stock_inicial", n, 0, { nota: venc && n > 0 ? `Vence ${venc}` : "" });
        mensaje = `Stock inicial de ${p.nombre}: ${unidades(n, p.unidad)}.`;
        break;
      }
      case "reservar": {
        const cliente = texto(cmd.cliente, "cliente", "Cliente");
        if (!cliente) throw new ErrorNegocio("Escribí para quién es la reserva.");
        const fechaEntrega = fecha(cmd.fechaEntrega, "Fecha de entrega");
        const nota = texto(cmd.nota, "nota", "Nota");
        const items = agrupar(cmd.items);
        if (items.length === 0) throw new ErrorNegocio("Agregá al menos un producto a la reserva.");
        const faltantes = [];
        for (const it of items) {
          const p = vendible(it.productoId);
          entero(it.cantidad, { min: 1, etiqueta: `Cantidad de ${p.nombre}` });
          const d = disponible(p);
          if (d < it.cantidad) faltantes.push(`${p.nombre} (hay ${Math.max(d, 0)}, pediste ${it.cantidad})`);
        }
        if (faltantes.length) throw new ErrorNegocio(`No alcanza el stock disponible: ${faltantes.join("; ")}.`);
        const numero = datos.pedidos.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
        const pedido = {
          id: op.nuevoId(),
          numero,
          cliente,
          fechaEntrega,
          nota,
          items: items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
          estado: "pendiente",
          creado: op.ahora,
          creadoPor: actor.email,
          creadoPorNombre: actor.nombre,
          cerrado: "",
          cerradoPor: "",
          cerradoPorNombre: "",
          cierreNota: ""
        };
        for (const it of items) mover(it.productoId, "reserva", 0, it.cantidad, { pedido, nota: cliente });
        pedidosTocados.set(pedido.id, pedido);
        mensaje = `Reserva #${numero} para ${cliente} guardada.`;
        break;
      }
      case "entregar": {
        const original = pedidoPendiente(cmd.pedidoId);
        const nota = texto(cmd.nota, "nota", "Nota");
        const entregas = /* @__PURE__ */ new Map();
        for (const it of Array.isArray(cmd.items) ? cmd.items : []) {
          if (it && typeof it.productoId === "string") entregas.set(it.productoId, it.cantidad);
        }
        const pedido = __spreadProps(__spreadValues({}, original), { items: original.items.map((it) => __spreadValues({}, it)) });
        let total = 0;
        let liberadas = 0;
        for (const it of pedido.items) {
          const p = ver(it.productoId);
          const e = entregas.has(it.productoId) ? entero(entregas.get(it.productoId), { min: 0, etiqueta: `Entrega de ${p.nombre}` }) : it.cantidad;
          if (e > it.cantidad) {
            throw new ErrorNegocio(
              `De ${p.nombre} se reservaron ${it.cantidad}. Si se llevan más, registrá una venta aparte.`
            );
          }
          if (e > p.fisico) throw new ErrorNegocio(`Solo hay ${unidades(p.fisico, p.unidad)} físicas de ${p.nombre}.`);
          it.entregado = e;
          total += e;
          liberadas += it.cantidad - e;
        }
        if (total === 0) throw new ErrorNegocio("No se entrega nada: si el cliente no retira, cancelá la reserva.");
        for (const it of pedido.items) {
          const p = ver(it.productoId);
          const liberar = Math.min(it.cantidad, p.reservado);
          const e = (_a = it.entregado) != null ? _a : 0;
          const partes = [
            e < it.cantidad ? `Entregó ${e} de ${it.cantidad}; se liberaron ${it.cantidad - e}` : "",
            nota
          ].filter(Boolean);
          mover(it.productoId, "entrega", -e, -liberar, { pedido, nota: partes.join(" · ") || pedido.cliente });
        }
        pedido.estado = "entregado";
        pedido.cerrado = op.ahora;
        pedido.cerradoPor = actor.email;
        pedido.cerradoPorNombre = actor.nombre;
        pedido.cierreNota = nota;
        pedidosTocados.set(pedido.id, pedido);
        mensaje = `Reserva #${pedido.numero} entregada.` + (liberadas === 1 ? " Se liberó 1 para la venta." : liberadas > 1 ? ` Se liberaron ${liberadas} para la venta.` : "");
        break;
      }
      case "cancelar": {
        const original = pedidoPendiente(cmd.pedidoId);
        const motivo = texto(cmd.motivo, "nota", "Motivo");
        const pedido = __spreadValues({}, original);
        for (const it of pedido.items) {
          const p = ver(it.productoId);
          mover(it.productoId, "cancelacion", 0, -Math.min(it.cantidad, p.reservado), {
            pedido,
            nota: motivo || pedido.cliente
          });
        }
        pedido.estado = "cancelado";
        pedido.cerrado = op.ahora;
        pedido.cerradoPor = actor.email;
        pedido.cerradoPorNombre = actor.nombre;
        pedido.cierreNota = motivo;
        pedidosTocados.set(pedido.id, pedido);
        mensaje = `Reserva #${pedido.numero} cancelada. Las bandejas volvieron a estar disponibles.`;
        break;
      }
      case "editar_reserva": {
        const original = pedidoPendiente(cmd.pedidoId);
        const cliente = texto(cmd.cliente, "cliente", "Cliente");
        if (!cliente) throw new ErrorNegocio("Escribí para quién es la reserva.");
        const pedido = __spreadProps(__spreadValues({}, original), {
          cliente,
          fechaEntrega: fecha(cmd.fechaEntrega, "Fecha de entrega"),
          nota: texto(cmd.nota, "nota", "Nota")
        });
        pedidosTocados.set(pedido.id, pedido);
        mensaje = `Reserva #${pedido.numero} actualizada.`;
        break;
      }
      case "descarte": {
        const p0 = ver(cmd.productoId);
        if (!p0.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p0.nombre}.`);
        const n = entero(cmd.cantidad, { min: 1, etiqueta: "Cantidad" });
        if (n > p0.fisico) {
          throw new ErrorNegocio(`Hay ${unidades(p0.fisico, p0.unidad)} físicas de ${p0.nombre}; no se pueden descartar más.`);
        }
        const p = mover(p0.id, "descarte", -n, 0, { nota: texto(cmd.nota, "nota", "Motivo") || "Descarte" });
        mensaje = `Descarte registrado: ${unidades(n, p.unidad)} de ${p.nombre}.` + aviso(p);
        break;
      }
      case "conteo": {
        const p0 = ver(cmd.productoId);
        const contado = entero(cmd.contado, { min: 0, etiqueta: "Cantidad contada" });
        const nota = texto(cmd.nota, "nota", "Nota");
        const eraPendiente = !p0.stockCargado;
        const dif = contado - p0.fisico;
        tocar(p0.id).stockCargado = true;
        const p = mover(p0.id, "conteo", dif, 0, {
          nota: nota || (eraPendiente ? "Primer conteo" : dif === 0 ? "Conteo sin diferencias" : "Conteo de inventario")
        });
        mensaje = dif === 0 ? `Conteo de ${p.nombre}: sin diferencias.` : `Conteo de ${p.nombre}: ${dif > 0 ? "+" : ""}${dif}. Ahora hay ${unidades(p.fisico, p.unidad)}.`;
        mensaje += aviso(p);
        break;
      }
      case "correccion": {
        const p0 = ver(cmd.productoId);
        if (!p0.stockCargado) throw new ErrorNegocio(`Primero hay que cargar el stock inicial de ${p0.nombre}.`);
        const dif = cmd.diferencia;
        if (typeof dif !== "number" || !Number.isInteger(dif) || dif === 0 || Math.abs(dif) > MAX_CANTIDAD) {
          throw new ErrorNegocio("La corrección tiene que ser un número entero distinto de cero (por ejemplo 2 o -2).");
        }
        const nota = texto(cmd.nota, "nota", "Motivo");
        if (!nota) throw new ErrorNegocio("Escribí el motivo de la corrección.");
        if (p0.fisico + dif < 0) throw new ErrorNegocio(`Hay ${unidades(p0.fisico, p0.unidad)} físicas de ${p0.nombre}.`);
        const p = mover(p0.id, "ajuste", dif, 0, { nota });
        mensaje = `Corrección registrada en ${p.nombre}: ${dif > 0 ? "+" : ""}${dif}.` + aviso(p);
        break;
      }
      case "crear_producto": {
        const d = validarDatos((_b = cmd.datos) != null ? _b : {}, null);
        if (!d.nombre) throw new ErrorNegocio("Escribí el nombre del producto.");
        if (!d.categoria) throw new ErrorNegocio("Elegí la categoría.");
        verificarNombreUnico(d.nombre, null, datos.productos);
        let id = slug(d.nombre) || "producto";
        for (let i = 2; originales.has(id); i++) id = `${slug(d.nombre) || "producto"}-${i}`;
        const orden = (_c = d.orden) != null ? _c : datos.productos.filter((x) => x.categoria === d.categoria).reduce((m, x) => Math.max(m, x.orden), 0) + 1;
        const nuevo = {
          id,
          nombre: d.nombre,
          categoria: d.categoria,
          unidad: (_d = d.unidad) != null ? _d : "bandeja",
          descripcion: (_e = d.descripcion) != null ? _e : "",
          fisico: 0,
          reservado: 0,
          minimo: (_f = d.minimo) != null ? _f : 0,
          stockCargado: false,
          activo: (_g = d.activo) != null ? _g : true,
          orden,
          notas: (_h = d.notas) != null ? _h : "",
          proveedor: (_i = d.proveedor) != null ? _i : "",
          sku: (_j = d.sku) != null ? _j : "",
          calidad: (_k = d.calidad) != null ? _k : "",
          fechaIngreso: (_l = d.fechaIngreso) != null ? _l : "",
          vencimiento: (_m = d.vencimiento) != null ? _m : "",
          foto: (_n = d.foto) != null ? _n : "",
          actualizado: op.ahora
        };
        originales.set(id, nuevo);
        mover(id, "producto", 0, 0, { nota: "Producto creado" });
        mensaje = `Producto ${nuevo.nombre} creado. Falta cargar su stock inicial.`;
        break;
      }
      case "editar_producto": {
        const p0 = ver(cmd.productoId);
        const d = validarDatos((_o = cmd.datos) != null ? _o : {}, p0);
        if (d.nombre !== void 0) {
          if (!d.nombre) throw new ErrorNegocio("El nombre no puede quedar vacío.");
          verificarNombreUnico(d.nombre, p0.id, datos.productos);
        }
        if (d.activo === false && p0.reservado > 0) {
          throw new ErrorNegocio(`${p0.nombre} tiene reservas pendientes. Entregalas o cancelalas antes de desactivarlo.`);
        }
        const cambios = describirCambios(p0, d);
        if (cambios.length === 0) {
          mensaje = "No había cambios para guardar.";
          break;
        }
        const p = tocar(p0.id);
        Object.assign(p, d);
        mover(p.id, "producto", 0, 0, { nota: `Cambió: ${cambios.join("; ")}`.slice(0, 500) });
        mensaje = `${p.nombre} actualizado.`;
        break;
      }
      default:
        throw new ErrorNegocio("Operación desconocida.");
    }
    return {
      productos: [...tocados.values()],
      pedidos: [...pedidosTocados.values()],
      movimientos,
      mensaje
    };
  }
  function agrupar(items) {
    var _a;
    if (!Array.isArray(items)) return [];
    const suma = /* @__PURE__ */ new Map();
    for (const it of items) {
      if (!it || typeof it.productoId !== "string") throw new ErrorNegocio("Hay un renglón inválido en la reserva.");
      const n = it.cantidad;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_CANTIDAD) {
        throw new ErrorNegocio("Las cantidades tienen que ser números enteros mayores que cero.");
      }
      suma.set(it.productoId, ((_a = suma.get(it.productoId)) != null ? _a : 0) + n);
    }
    return [...suma].map(([productoId, cantidad]) => ({ productoId, cantidad }));
  }
  function verificarNombreUnico(nombre, idPropio, productos) {
    const n = normalizar(nombre);
    const otro = productos.find((p) => p.id !== idPropio && normalizar(p.nombre) === n);
    if (otro) throw new ErrorNegocio(`Ya existe un producto llamado ${otro.nombre}.`);
  }
  var ETIQUETAS = {
    nombre: "nombre",
    categoria: "categoría",
    unidad: "unidad",
    descripcion: "descripción",
    minimo: "stock mínimo",
    activo: "activo",
    orden: "orden",
    notas: "notas",
    proveedor: "proveedor",
    sku: "código",
    calidad: "calidad",
    fechaIngreso: "fecha de ingreso",
    vencimiento: "vencimiento",
    foto: "foto"
  };
  function validarDatos(entrada, actual) {
    const d = {};
    const e = entrada;
    if ("nombre" in e) d.nombre = texto(e.nombre, "nombre", "Nombre");
    if ("categoria" in e) {
      if (e.categoria !== "flores" && e.categoria !== "hojas") throw new ErrorNegocio("Categoría inválida.");
      d.categoria = e.categoria;
    }
    if ("unidad" in e) {
      if (e.unidad !== "bandeja" && e.unidad !== "envase") throw new ErrorNegocio("Unidad inválida.");
      d.unidad = e.unidad;
    }
    if ("descripcion" in e) d.descripcion = texto(e.descripcion, "descripcion", "Descripción");
    if ("minimo" in e) d.minimo = entero(e.minimo, { min: 0, etiqueta: "Stock mínimo" });
    if ("activo" in e) {
      if (typeof e.activo !== "boolean") throw new ErrorNegocio("Activo: valor inválido.");
      d.activo = e.activo;
    }
    if ("orden" in e) d.orden = entero(e.orden, { min: 0, etiqueta: "Orden" });
    if ("notas" in e) d.notas = texto(e.notas, "notas", "Notas");
    if ("proveedor" in e) d.proveedor = texto(e.proveedor, "proveedor", "Proveedor");
    if ("sku" in e) d.sku = texto(e.sku, "sku", "Código");
    if ("calidad" in e) d.calidad = texto(e.calidad, "calidad", "Observaciones de calidad");
    if ("fechaIngreso" in e) d.fechaIngreso = fecha(e.fechaIngreso, "Fecha de ingreso");
    if ("vencimiento" in e) d.vencimiento = fecha(e.vencimiento, "Vencimiento");
    if ("foto" in e) {
      const f = texto(e.foto, "foto", "Foto");
      if (f && !/^https:\/\//.test(f) && !/^\/fotos\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/.test(f)) {
        throw new ErrorNegocio("Foto: tiene que ser un enlace https.");
      }
      d.foto = f;
    }
    if (actual) {
      for (const k of Object.keys(d)) {
        if (d[k] === actual[k]) delete d[k];
      }
    }
    return d;
  }
  function describirCambios(actual, d) {
    return Object.keys(d).map((k) => {
      const antes = actual[k];
      const despues = d[k];
      if (k === "nombre" || k === "minimo" || k === "categoria" || k === "unidad" || k === "activo" || k === "vencimiento" || k === "fechaIngreso") {
        return `${ETIQUETAS[k]} (${formatoValor(antes)} → ${formatoValor(despues)})`;
      }
      return ETIQUETAS[k];
    });
  }
  function formatoValor(v) {
    if (v === true) return "sí";
    if (v === false) return "no";
    if (v === "" || v === void 0 || v === null) return "vacío";
    return String(v);
  }
  function revisarConsistencia(productos, movimientos, pedidos) {
    var _a, _b, _c, _d;
    const fisico = /* @__PURE__ */ new Map();
    for (const m of movimientos) fisico.set(m.productoId, ((_a = fisico.get(m.productoId)) != null ? _a : 0) + m.dFisico);
    const reservado = /* @__PURE__ */ new Map();
    for (const pe of pedidos) {
      if (pe.estado !== "pendiente") continue;
      for (const it of pe.items) reservado.set(it.productoId, ((_b = reservado.get(it.productoId)) != null ? _b : 0) + it.cantidad);
    }
    const problemas = [];
    for (const p of productos) {
      const f = (_c = fisico.get(p.id)) != null ? _c : 0;
      const r = (_d = reservado.get(p.id)) != null ? _d : 0;
      const partes = [];
      if (f !== p.fisico) partes.push(`físico ${p.fisico}, según el historial ${f}`);
      if (r !== p.reservado) partes.push(`reservado ${p.reservado}, según las reservas ${r}`);
      if (partes.length) problemas.push({ productoId: p.id, nombre: p.nombre, detalle: partes.join("; ") });
    }
    return problemas;
  }

  // gas/servidor.ts
  var VERSION_API = 1;
  var DIAS_RESERVAS_CERRADAS = 30;
  var DIAS_SESION = 90;
  var ITERACIONES_CLAVE = 1e3;
  var MAX_INTENTOS = 5;
  var ErrorSesion = class extends ErrorNegocio {
    constructor() {
      super(...arguments);
      this.codigo = "sesion";
    }
  };
  var col = (campo, titulo, tipo = "texto", ancho) => ({
    campo,
    titulo,
    tipo,
    ancho
  });
  var T_PRODUCTOS = {
    hoja: "Productos",
    clave: "id",
    columnas: [
      col("id", "ID", "texto", 140),
      col("nombre", "Nombre", "texto", 160),
      col("categoria", "Categoría", "texto", 80),
      col("unidad", "Unidad", "texto", 80),
      col("fisico", "Físico", "numero", 70),
      col("reservado", "Reservado", "numero", 80),
      __spreadProps(__spreadValues({}, col("disponible", "Disponible", "numero", 85)), { calc: (p) => p.fisico - p.reservado }),
      col("minimo", "Stock mínimo", "numero", 95),
      col("stockCargado", "Stock cargado", "bool", 100),
      col("activo", "Activo", "bool", 60),
      col("fechaIngreso", "Último ingreso", "fecha", 105),
      col("vencimiento", "Vencimiento", "fecha", 100),
      col("descripcion", "Descripción", "texto", 260),
      col("notas", "Notas internas", "texto", 200),
      col("proveedor", "Proveedor", "texto", 120),
      col("sku", "Código / SKU", "texto", 100),
      col("calidad", "Observaciones de calidad", "texto", 200),
      col("foto", "Foto", "texto", 160),
      col("orden", "Orden", "numero", 60),
      col("actualizado", "Actualizado", "texto", 170)
    ]
  };
  var T_RESERVAS = {
    hoja: "Reservas",
    clave: "id",
    columnas: [
      col("numero", "N°", "numero", 50),
      col("estado", "Estado", "texto", 90),
      col("cliente", "Cliente", "texto", 160),
      col("fechaEntrega", "Fecha de entrega", "fecha", 115),
      __spreadProps(__spreadValues({}, col("detalle", "Detalle", "texto", 260)), { calc: (p) => detallePedido(p) }),
      col("nota", "Nota", "texto", 180),
      col("creado", "Creada", "texto", 170),
      col("creadoPorNombre", "Creada por", "texto", 110),
      col("cerrado", "Cerrada", "texto", 170),
      col("cerradoPorNombre", "Cerrada por", "texto", 110),
      col("cierreNota", "Nota de cierre", "texto", 160),
      col("items", "Items (no editar)", "json", 200),
      col("id", "ID", "texto", 120),
      col("creadoPor", "Email creó", "texto", 160),
      col("cerradoPor", "Email cerró", "texto", 160)
    ]
  };
  var T_MOVIMIENTOS = {
    hoja: "Movimientos",
    clave: "id",
    columnas: [
      col("fecha", "Fecha", "texto", 170),
      col("usuarioNombre", "Usuario", "texto", 110),
      col("tipo", "Tipo", "texto", 100),
      col("productoNombre", "Producto", "texto", 150),
      col("dFisico", "Δ Físico", "numero", 70),
      col("dReservado", "Δ Reservado", "numero", 90),
      col("fisico", "Físico después", "numero", 105),
      col("reservado", "Reservado después", "numero", 125),
      col("pedidoNumero", "Reserva N°", "numero", 85),
      col("nota", "Nota", "texto", 220),
      col("productoId", "ID producto", "texto", 130),
      col("usuario", "Email", "texto", 160),
      col("pedidoId", "ID reserva", "texto", 120),
      col("opId", "ID operación", "texto", 120),
      col("id", "ID", "texto", 120)
    ]
  };
  var T_USUARIOS = {
    hoja: "Usuarios",
    clave: "email",
    columnas: [
      col("email", "Email", "texto", 200),
      col("nombre", "Nombre", "texto", 140),
      col("rol", "Rol", "texto", 80),
      col("activo", "Activo", "bool", 60),
      col("debeCambiar", "Debe cambiar contraseña", "bool", 160),
      col("clave", "Clave (no tocar)", "texto", 160),
      col("version", "Versión", "numero", 70),
      col("creado", "Creado", "texto", 170)
    ]
  };
  var TABLAS = [T_PRODUCTOS, T_RESERVAS, T_MOVIMIENTOS, T_USUARIOS];
  function libro() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  function hoja(t) {
    const h = libro().getSheetByName(t.hoja);
    if (!h) throw new ErrorNegocio(`Falta la hoja "${t.hoja}". Abrí la planilla y usá el menú Stock Flores → Preparar planilla.`);
    return h;
  }
  function esFechaCelda(v) {
    return Object.prototype.toString.call(v) === "[object Date]";
  }
  function zona() {
    return Session.getScriptTimeZone() || "America/Argentina/Buenos_Aires";
  }
  function leerCelda(v, tipo) {
    switch (tipo) {
      case "numero": {
        const n = typeof v === "number" ? v : Number(String(v != null ? v : "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
      }
      case "bool":
        if (typeof v === "boolean") return v;
        return ["true", "verdadero", "si", "sí", "1", "x"].includes(String(v != null ? v : "").trim().toLowerCase());
      case "json":
        try {
          return v ? JSON.parse(String(v)) : [];
        } catch (e) {
          return [];
        }
      case "fecha":
        if (esFechaCelda(v)) return Utilities.formatDate(v, zona(), "yyyy-MM-dd");
        return String(v != null ? v : "").trim();
      default:
        if (esFechaCelda(v)) return v.toISOString();
        return v === null || v === void 0 ? "" : String(v);
    }
  }
  function escribirCelda(v, tipo) {
    switch (tipo) {
      case "numero":
        return typeof v === "number" && Number.isFinite(v) ? v : 0;
      case "bool":
        return v === true;
      case "json":
        return JSON.stringify(v != null ? v : []);
      default: {
        const s = v === null || v === void 0 ? "" : String(v);
        return /^[=+\-@]/.test(s) ? `'${s}` : s;
      }
    }
  }
  function indices(h, t) {
    const ancho = h.getLastColumn();
    const encabezado = ancho ? h.getRange(1, 1, 1, ancho).getValues()[0].map((v) => String(v).trim()) : [];
    const idx = t.columnas.map((c) => {
      const i = encabezado.indexOf(c.titulo);
      if (i < 0) {
        throw new ErrorNegocio(`Falta la columna "${c.titulo}" en la hoja "${t.hoja}". Usá el menú Stock Flores → Preparar planilla.`);
      }
      return i;
    });
    return { idx, ancho };
  }
  function leer(t, desde, hasta) {
    const h = hoja(t);
    const { idx, ancho } = indices(h, t);
    const ultima = h.getLastRow();
    const ini = Math.max(2, desde != null ? desde : 2);
    const fin = Math.min(ultima, hasta != null ? hasta : ultima);
    const filas = [];
    if (fin >= ini) {
      const valores = h.getRange(ini, 1, fin - ini + 1, ancho).getValues();
      const iClave = t.columnas.findIndex((c) => c.campo === t.clave);
      valores.forEach((crudo, i) => {
        var _a;
        if (String((_a = crudo[idx[iClave]]) != null ? _a : "").trim() === "") return;
        const obj = {};
        t.columnas.forEach((c, j) => {
          if (!c.calc) obj[c.campo] = leerCelda(crudo[idx[j]], c.tipo);
        });
        filas.push({ obj, fila: ini + i, crudo });
      });
    }
    return { hoja: h, filas, idx, ancho };
  }
  function armarFila(obj, t, idx, base) {
    const fila = base.slice();
    t.columnas.forEach((c, j) => {
      const v = c.calc ? c.calc(obj) : obj[c.campo];
      fila[idx[j]] = escribirCelda(v, c.tipo);
    });
    return fila;
  }
  function asegurarFilas(h, necesarias) {
    const max = h.getMaxRows();
    if (necesarias > max) h.insertRowsAfter(max, necesarias - max + 100);
  }
  function guardar(l, t, objetos) {
    if (objetos.length === 0) return;
    const porClave = new Map(l.filas.map((f) => [String(f.obj[t.clave]), f]));
    const nuevas = [];
    for (const o of objetos) {
      const existente = porClave.get(String(o[t.clave]));
      if (existente) {
        const fila = armarFila(o, t, l.idx, existente.crudo);
        l.hoja.getRange(existente.fila, 1, 1, l.ancho).setValues([fila]);
      } else {
        nuevas.push(armarFila(o, t, l.idx, new Array(l.ancho).fill("")));
      }
    }
    agregar(l.hoja, nuevas);
  }
  function agregar(h, filas) {
    if (filas.length === 0) return;
    const desde = h.getLastRow() + 1;
    asegurarFilas(h, desde + filas.length - 1);
    h.getRange(desde, 1, filas.length, filas[0].length).setValues(filas);
  }
  function agregarMovimientos(movs) {
    if (movs.length === 0) return;
    const h = hoja(T_MOVIMIENTOS);
    const { idx, ancho } = indices(h, T_MOVIMIENTOS);
    agregar(
      h,
      movs.map((m) => armarFila(m, T_MOVIMIENTOS, idx, new Array(ancho).fill("")))
    );
  }
  function detallePedido(p) {
    const nombres = new Map(leerProductosCache().map((x) => [x.id, x.nombre]));
    return p.items.map((it) => {
      var _a;
      const nombre = (_a = nombres.get(it.productoId)) != null ? _a : it.productoId;
      return it.entregado !== void 0 && it.entregado !== it.cantidad ? `${it.entregado}/${it.cantidad} ${nombre}` : `${it.cantidad} ${nombre}`;
    }).join(", ");
  }
  var productosCache = null;
  function leerProductosCache() {
    if (!productosCache) productosCache = leer(T_PRODUCTOS).filas.map((f) => f.obj);
    return productosCache;
  }
  var SEG_CACHE = 21600;
  function propiedad(clave) {
    const cache = CacheService.getScriptCache();
    const enCache = cache.get(`prop:${clave}`);
    if (enCache !== null) return enCache;
    const valor = PropertiesService.getScriptProperties().getProperty(clave);
    if (valor !== null) cache.put(`prop:${clave}`, valor, SEG_CACHE);
    return valor;
  }
  function fijarPropiedad(clave, valor) {
    PropertiesService.getScriptProperties().setProperty(clave, valor);
    CacheService.getScriptCache().put(`prop:${clave}`, valor, SEG_CACHE);
  }
  function versionActual() {
    return Number(propiedad("VERSION") || "1");
  }
  function subirVersion() {
    const v = Number(PropertiesService.getScriptProperties().getProperty("VERSION") || "1") + 1;
    fijarPropiedad("VERSION", String(v));
    return v;
  }
  function hex(bytes) {
    return bytes.map((b) => (b & 255).toString(16).padStart(2, "0")).join("");
  }
  function aleatorio() {
    return Utilities.getUuid().replace(/-/g, "");
  }
  function secreto() {
    let s = propiedad("SECRETO");
    if (!s) {
      s = aleatorio() + aleatorio();
      fijarPropiedad("SECRETO", s);
    }
    return s;
  }
  function hashClave(clave, sal, iteraciones) {
    const llave = Utilities.newBlob(clave).getBytes();
    let h = Utilities.computeHmacSha256Signature(Utilities.newBlob(sal).getBytes(), llave);
    for (let i = 1; i < iteraciones; i++) h = Utilities.computeHmacSha256Signature(h, llave);
    return hex(h);
  }
  function crearClave(clave) {
    const sal = aleatorio();
    return `${ITERACIONES_CLAVE}$${sal}$${hashClave(clave, sal, ITERACIONES_CLAVE)}`;
  }
  function verificarClave(clave, guardada) {
    const [it, sal, hash] = String(guardada).split("$");
    if (!it || !sal || !hash) return false;
    return iguales(hashClave(clave, sal, Number(it)), hash);
  }
  function iguales(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  function firmar(texto2) {
    return hex(Utilities.computeHmacSha256Signature(texto2, secreto()));
  }
  function crearToken(u) {
    const vence = Date.now() + DIAS_SESION * 24 * 3600 * 1e3;
    const datos = `${u.email}|${u.version}|${vence}`;
    return `${datos}|${firmar(datos)}`;
  }
  var PALABRAS = ["rosa", "lila", "menta", "salvia", "tilo", "malva", "romero", "albahaca", "violeta", "jazmin"];
  function claveTemporal() {
    const r = aleatorio();
    const palabra = PALABRAS[parseInt(r.slice(0, 4), 16) % PALABRAS.length];
    const numero = String(parseInt(r.slice(4, 12), 16) % 1e4).padStart(4, "0");
    return `${palabra}-${numero}`;
  }
  function normalizarEmail(email) {
    return String(email != null ? email : "").trim().toLowerCase();
  }
  function leerUsuarios() {
    const l = leer(T_USUARIOS);
    for (const f of l.filas) {
      f.obj.email = normalizarEmail(f.obj.email);
      f.obj.rol = f.obj.rol === "admin" ? "admin" : "vendedor";
    }
    return l;
  }
  function publico(u) {
    return { email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo };
  }
  function autenticar(token) {
    var _a;
    const partes = String(token != null ? token : "").split("|");
    if (partes.length !== 4) throw new ErrorSesion("Tu sesión terminó. Volvé a entrar.");
    const [email, version, vence, firma] = partes;
    if (!iguales(firmar(`${email}|${version}|${vence}`), firma) || Number(vence) < Date.now()) {
      throw new ErrorSesion("Tu sesión terminó. Volvé a entrar.");
    }
    const u = (_a = leerUsuarios().filas.find((f) => f.obj.email === email)) == null ? void 0 : _a.obj;
    if (!u || !u.activo || String(u.version) !== version) throw new ErrorSesion("Tu sesión terminó. Volvé a entrar.");
    return u;
  }
  function login(email, clave) {
    var _a;
    const e = normalizarEmail(email);
    if (!e || typeof clave !== "string" || !clave) throw new ErrorNegocio("Completá el email y la contraseña.");
    const cache = CacheService.getScriptCache();
    const k = `fallos:${e}`;
    const fallos = Number(cache.get(k) || "0");
    if (fallos >= MAX_INTENTOS) throw new ErrorNegocio("Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.");
    const u = (_a = leerUsuarios().filas.find((f) => f.obj.email === e)) == null ? void 0 : _a.obj;
    if (!u || !u.activo || !verificarClave(clave, u.clave)) {
      cache.put(k, String(fallos + 1), 900);
      throw new ErrorNegocio("Email o contraseña incorrectos.");
    }
    cache.remove(k);
    return { token: crearToken(u), usuario: publico(u), debeCambiar: u.debeCambiar };
  }
  function validarClaveNueva(nueva) {
    if (typeof nueva !== "string" || nueva.length < 6) throw new ErrorNegocio("La contraseña nueva tiene que tener al menos 6 caracteres.");
    if (nueva.length > 100) throw new ErrorNegocio("La contraseña es demasiado larga.");
    return nueva;
  }
  function leerEstado(usuario) {
    const productos = leerProductosCache();
    const limite = new Date(Date.now() - DIAS_RESERVAS_CERRADAS * 24 * 3600 * 1e3).toISOString();
    const pedidos = leer(T_RESERVAS).filas.map((f) => f.obj).filter((p) => p.estado === "pendiente" || p.cerrado >= limite);
    return { version: versionActual(), productos, pedidos, usuario: publico(usuario), ahora: (/* @__PURE__ */ new Date()).toISOString() };
  }
  function conBloqueo(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(2e4)) throw new ErrorNegocio("El sistema está ocupado. Probá de nuevo en unos segundos.");
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }
  function operar(u, opId, comando) {
    if (typeof opId !== "string" || opId.length < 8 || opId.length > 64) throw new ErrorNegocio("Operación inválida.");
    return conBloqueo(() => {
      const cache = CacheService.getScriptCache();
      const previa = cache.get(`op:${opId}`);
      if (previa) {
        productosCache = null;
        return { mensaje: previa, repetida: true, estado: leerEstado(u) };
      }
      productosCache = null;
      const lp = leer(T_PRODUCTOS);
      const lr = leer(T_RESERVAS);
      const datos = { productos: lp.filas.map((f) => f.obj), pedidos: lr.filas.map((f) => f.obj) };
      const actor = { email: u.email, nombre: u.nombre, rol: u.rol };
      const r = ejecutar(comando, datos, actor, {
        ahora: (/* @__PURE__ */ new Date()).toISOString(),
        hoy: Utilities.formatDate(/* @__PURE__ */ new Date(), zona(), "yyyy-MM-dd"),
        opId,
        nuevoId: aleatorio
      });
      const cambiados = new Map(r.productos.map((p) => [p.id, p]));
      productosCache = datos.productos.map((p) => {
        var _a;
        return (_a = cambiados.get(p.id)) != null ? _a : p;
      }).concat(
        r.productos.filter((p) => !datos.productos.some((x) => x.id === p.id))
      );
      guardar(lp, T_PRODUCTOS, r.productos);
      guardar(lr, T_RESERVAS, r.pedidos);
      agregarMovimientos(r.movimientos);
      SpreadsheetApp.flush();
      if (r.movimientos.length || r.pedidos.length || r.productos.length) subirVersion();
      cache.put(`op:${opId}`, r.mensaje, 21600);
      return { mensaje: r.mensaje, estado: leerEstado(u) };
    });
  }
  function historial(productoId, tipos, limite, cursor) {
    const h = hoja(T_MOVIMIENTOS);
    const max = Math.min(Math.max(Number(limite) || 100, 1), 500);
    const filtroTipos = Array.isArray(tipos) && tipos.length ? new Set(tipos.map(String)) : null;
    let fin = typeof cursor === "number" && cursor >= 2 ? Math.min(cursor, h.getLastRow()) : h.getLastRow();
    const salida = [];
    while (fin >= 2 && salida.length < max) {
      const ini = Math.max(2, fin - 499);
      const l = leer(T_MOVIMIENTOS, ini, fin);
      let siguiente = ini - 1;
      for (let i = l.filas.length - 1; i >= 0; i--) {
        const m = l.filas[i];
        if (productoId && m.obj.productoId !== productoId) continue;
        if (filtroTipos && !filtroTipos.has(m.obj.tipo)) continue;
        salida.push(m.obj);
        if (salida.length >= max) {
          siguiente = m.fila - 1;
          break;
        }
      }
      fin = siguiente;
    }
    return { movimientos: salida, cursor: fin >= 2 ? fin : null };
  }
  function soloAdmin(u) {
    if (u.rol !== "admin") throw new ErrorNegocio("Esta operación solo la puede hacer un administrador.");
  }
  function validarRol(rol) {
    if (rol !== "admin" && rol !== "vendedor") throw new ErrorNegocio("Rol inválido.");
    return rol;
  }
  function validarNombre(nombre) {
    const n = String(nombre != null ? nombre : "").trim();
    if (!n) throw new ErrorNegocio("Escribí el nombre.");
    if (n.length > 40) throw new ErrorNegocio("El nombre es demasiado largo.");
    return n;
  }
  function crearUsuario(email, nombre, rol) {
    const e = normalizarEmail(email);
    if (!/^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/.test(e) || e.length > 120) throw new ErrorNegocio("El email no es válido.");
    const n = validarNombre(nombre);
    const r = validarRol(rol);
    return conBloqueo(() => {
      const l = leerUsuarios();
      if (l.filas.some((f) => f.obj.email === e)) throw new ErrorNegocio("Ya existe un usuario con ese email.");
      const temporal = claveTemporal();
      const nuevo = {
        email: e,
        nombre: n,
        rol: r,
        activo: true,
        debeCambiar: true,
        clave: crearClave(temporal),
        version: 1,
        creado: (/* @__PURE__ */ new Date()).toISOString()
      };
      guardar(l, T_USUARIOS, [nuevo]);
      return { usuario: publico(nuevo), claveTemporal: temporal };
    });
  }
  function editarUsuario(admin, req) {
    const e = normalizarEmail(req.email);
    return conBloqueo(() => {
      var _a;
      const l = leerUsuarios();
      const u = (_a = l.filas.find((f) => f.obj.email === e)) == null ? void 0 : _a.obj;
      if (!u) throw new ErrorNegocio("No encontré ese usuario.");
      const cambio = __spreadValues({}, u);
      if (req.nombre !== void 0) cambio.nombre = validarNombre(req.nombre);
      if (req.rol !== void 0) cambio.rol = validarRol(req.rol);
      if (req.activo !== void 0) cambio.activo = req.activo === true;
      if (u.email === admin.email && (!cambio.activo || cambio.rol !== "admin")) {
        throw new ErrorNegocio("No podés quitarte el acceso de administrador a vos mismo/a.");
      }
      if (cambio.rol !== u.rol || cambio.activo !== u.activo) cambio.version = u.version + 1;
      guardar(l, T_USUARIOS, [cambio]);
      return publico(cambio);
    });
  }
  function restablecerClave(email) {
    const e = normalizarEmail(email);
    return conBloqueo(() => {
      var _a;
      const l = leerUsuarios();
      const u = (_a = l.filas.find((f) => f.obj.email === e)) == null ? void 0 : _a.obj;
      if (!u) throw new ErrorNegocio("No encontré ese usuario.");
      const temporal = claveTemporal();
      guardar(l, T_USUARIOS, [__spreadProps(__spreadValues({}, u), { clave: crearClave(temporal), debeCambiar: true, version: u.version + 1 })]);
      CacheService.getScriptCache().remove(`fallos:${e}`);
      return temporal;
    });
  }
  function cambiarClave(u, actual, nueva) {
    const n = validarClaveNueva(nueva);
    if (typeof actual !== "string" || !verificarClave(actual, u.clave)) throw new ErrorNegocio("La contraseña actual no es correcta.");
    if (actual === n) throw new ErrorNegocio("La contraseña nueva tiene que ser distinta de la actual.");
    return conBloqueo(() => {
      const l = leerUsuarios();
      const fila = l.filas.find((f) => f.obj.email === u.email);
      if (!fila) throw new ErrorSesion("Tu sesión terminó. Volvé a entrar.");
      const nuevo = __spreadProps(__spreadValues({}, fila.obj), { clave: crearClave(n), debeCambiar: false, version: fila.obj.version + 1 });
      guardar(l, T_USUARIOS, [nuevo]);
      return { token: crearToken(nuevo), usuario: publico(nuevo), mensaje: "Contraseña cambiada." };
    });
  }
  function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }
  function despachar(req) {
    switch (req.accion) {
      case "ping":
        return { app: "stock-flores", version: VERSION_API };
      case "login":
        return login(req.email, req.password);
    }
    const u = autenticar(req.token);
    switch (req.accion) {
      case "estado":
        if (typeof req.version === "number" && req.version === versionActual()) {
          return { sinCambios: true, version: req.version };
        }
        return { estado: leerEstado(u) };
      case "operar":
        return operar(u, req.opId, req.comando);
      case "historial":
        return historial(req.productoId, req.tipos, req.limite, req.cursor);
      case "cambiar_password":
        return cambiarClave(u, req.actual, req.nueva);
      case "usuarios":
        soloAdmin(u);
        return { usuarios: leerUsuarios().filas.map((f) => publico(f.obj)) };
      case "crear_usuario":
        soloAdmin(u);
        return crearUsuario(req.email, req.nombre, req.rol);
      case "editar_usuario":
        soloAdmin(u);
        return { usuario: editarUsuario(u, req) };
      case "restablecer_password":
        soloAdmin(u);
        return { claveTemporal: restablecerClave(req.email) };
      default:
        throw new ErrorNegocio("Acción desconocida.");
    }
  }
  function doPost(e) {
    var _a, _b, _c;
    productosCache = null;
    let req;
    try {
      const cuerpo = (_b = (_a = e == null ? void 0 : e.postData) == null ? void 0 : _a.contents) != null ? _b : "";
      if (cuerpo.length > 1e5) throw new Error("grande");
      req = JSON.parse(cuerpo);
      if (!req || typeof req !== "object") throw new Error("vacío");
    } catch (e2) {
      return json({ ok: false, error: "Pedido inválido." });
    }
    try {
      return json(__spreadValues({ ok: true }, despachar(req)));
    } catch (err) {
      if (err instanceof ErrorNegocio) {
        return json({ ok: false, error: err.message, codigo: (_c = err.codigo) != null ? _c : "" });
      }
      console.error(err);
      return json({ ok: false, error: "Error interno del servidor. Probá de nuevo en un momento." });
    }
  }
  function doGet() {
    return json({ ok: true, app: "stock-flores", version: VERSION_API });
  }
  function onOpen() {
    SpreadsheetApp.getUi().createMenu("Stock Flores").addItem("Preparar planilla", "prepararPlanilla").addItem("Crear usuario", "menuCrearUsuario").addItem("Restablecer contraseña", "menuRestablecerClave").addItem("Revisar el stock contra el historial", "menuRevisarConsistencia").addToUi();
  }
  function prepararHoja(t) {
    const ss = libro();
    let h = ss.getSheetByName(t.hoja);
    if (!h) h = ss.insertSheet(t.hoja);
    const ancho = h.getLastColumn();
    const actuales = ancho ? h.getRange(1, 1, 1, ancho).getValues()[0].map((v) => String(v).trim()) : [];
    const faltan = t.columnas.filter((c) => !actuales.includes(c.titulo));
    if (faltan.length) {
      h.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan.map((c) => c.titulo)]);
    }
    const { idx } = indices(h, t);
    const filas = Math.max(h.getMaxRows() - 1, 1);
    t.columnas.forEach((c, j) => {
      const rango = h.getRange(2, idx[j] + 1, filas, 1);
      if (c.tipo === "texto" || c.tipo === "fecha" || c.tipo === "json") rango.setNumberFormat("@");
      if (c.ancho) h.setColumnWidth(idx[j] + 1, c.ancho);
    });
    h.getRange(1, 1, 1, h.getLastColumn()).setFontWeight("bold").setBackground("#f3e5ec");
    h.setFrozenRows(1);
    if (h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
      h.protect().setDescription("Se modifica desde la app de stock. Editar a mano puede descuadrar el historial.").setWarningOnly(true);
    }
    return h;
  }
  function prepararPlanilla() {
    const ui = SpreadsheetApp.getUi();
    for (const t of TABLAS) prepararHoja(t);
    secreto();
    const lp = leer(T_PRODUCTOS);
    let cargados = 0;
    if (lp.filas.length === 0) {
      const iniciales = productosIniciales((/* @__PURE__ */ new Date()).toISOString());
      guardar(lp, T_PRODUCTOS, iniciales);
      cargados = iniciales.length;
    }
    const ss = libro();
    for (const h of ss.getSheets()) {
      if (!TABLAS.some((t) => t.hoja === h.getName()) && h.getLastRow() === 0 && ss.getSheets().length > 1) {
        ss.deleteSheet(h);
      }
    }
    let mensajeUsuario = "";
    if (leerUsuarios().filas.length === 0) {
      const email = ui.prompt("Primer usuario administrador", "Email (con el que vas a entrar a la app):", ui.ButtonSet.OK_CANCEL);
      if (email.getSelectedButton() === ui.Button.OK && email.getResponseText().trim()) {
        const nombre = ui.prompt("Primer usuario administrador", "Nombre para mostrar (por ejemplo: Mamá):", ui.ButtonSet.OK_CANCEL);
        if (nombre.getSelectedButton() === ui.Button.OK) {
          const r = crearUsuario(email.getResponseText(), nombre.getResponseText(), "admin");
          mensajeUsuario = `

Usuario creado: ${r.usuario.email}
Contraseña temporal: ${r.claveTemporal}
(La app pide cambiarla al entrar.)`;
        }
      }
      if (!mensajeUsuario) mensajeUsuario = "\n\nTodavía no hay usuarios: creá uno con el menú Stock Flores → Crear usuario.";
    }
    subirVersion();
    ui.alert(
      "Planilla lista",
      (cargados ? `Se cargó el catálogo inicial (${cargados} productos, con el stock pendiente de cargar).` : "Las hojas están al día.") + mensajeUsuario + "\n\nÚltimo paso: Implementar → Nueva implementación → Aplicación web (Ejecutar como: yo; Acceso: cualquier usuario) y copiar la URL en la app.",
      ui.ButtonSet.OK
    );
  }
  function menuCrearUsuario() {
    const ui = SpreadsheetApp.getUi();
    const email = ui.prompt("Crear usuario", "Email:", ui.ButtonSet.OK_CANCEL);
    if (email.getSelectedButton() !== ui.Button.OK) return;
    const nombre = ui.prompt("Crear usuario", "Nombre para mostrar:", ui.ButtonSet.OK_CANCEL);
    if (nombre.getSelectedButton() !== ui.Button.OK) return;
    const rol = ui.prompt("Crear usuario", 'Rol: escribí "admin" (administra todo) o "vendedor":', ui.ButtonSet.OK_CANCEL);
    if (rol.getSelectedButton() !== ui.Button.OK) return;
    try {
      const r = crearUsuario(email.getResponseText(), nombre.getResponseText(), rol.getResponseText().trim().toLowerCase());
      ui.alert("Usuario creado", `${r.usuario.email}
Contraseña temporal: ${r.claveTemporal}`, ui.ButtonSet.OK);
    } catch (err) {
      ui.alert("No se pudo crear", err.message, ui.ButtonSet.OK);
    }
  }
  function menuRestablecerClave() {
    const ui = SpreadsheetApp.getUi();
    const email = ui.prompt("Restablecer contraseña", "Email del usuario:", ui.ButtonSet.OK_CANCEL);
    if (email.getSelectedButton() !== ui.Button.OK) return;
    try {
      const temporal = restablecerClave(email.getResponseText());
      ui.alert("Contraseña restablecida", `Contraseña temporal: ${temporal}`, ui.ButtonSet.OK);
    } catch (err) {
      ui.alert("No se pudo restablecer", err.message, ui.ButtonSet.OK);
    }
  }
  function menuRevisarConsistencia() {
    const ui = SpreadsheetApp.getUi();
    const problemas = revisarConsistencia(
      leer(T_PRODUCTOS).filas.map((f) => f.obj),
      leer(T_MOVIMIENTOS).filas.map((f) => f.obj),
      leer(T_RESERVAS).filas.map((f) => f.obj)
    );
    ui.alert(
      "Revisión del stock",
      problemas.length ? `Hay diferencias (probablemente por ediciones a mano en la planilla):

${problemas.map((p) => `• ${p.nombre}: ${p.detalle}`).join("\n")}

Corregilas desde la app con un conteo.` : "Todo coincide: el stock de cada producto es igual a la suma de su historial.",
      ui.ButtonSet.OK
    );
  }
  return __toCommonJS(servidor_exports);
})();

function doGet(e) {
  return StockFlores.doGet(e);
}
function doPost(e) {
  return StockFlores.doPost(e);
}
function onOpen(e) {
  return StockFlores.onOpen(e);
}
function prepararPlanilla(e) {
  return StockFlores.prepararPlanilla(e);
}
function menuCrearUsuario(e) {
  return StockFlores.menuCrearUsuario(e);
}
function menuRestablecerClave(e) {
  return StockFlores.menuRestablecerClave(e);
}
function menuRevisarConsistencia(e) {
  return StockFlores.menuRevisarConsistencia(e);
}
