// Imitación mínima de los servicios de Google Apps Script para probar el archivo .gs real en Node.
import { createHmac, randomUUID } from 'node:crypto';

type Celda = string | number | boolean | Date;

/** Bytes con signo, como los devuelve Apps Script (Java). */
function aBytes(b: Buffer): number[] {
  return [...b].map((x) => (x > 127 ? x - 256 : x));
}
function aBuffer(v: string | number[]): Buffer {
  return typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v.map((x) => x & 0xff));
}

export class FakeRange {
  constructor(
    private hoja: FakeSheet,
    private fila: number,
    private col: number,
    private filas: number,
    private cols: number,
  ) {
    if (fila < 1 || col < 1 || filas < 1 || cols < 1) throw new Error(`Rango inválido ${fila},${col},${filas},${cols}`);
    if (fila + filas - 1 > hoja.maxFilas) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
  }
  getValues(): Celda[][] {
    const out: Celda[][] = [];
    for (let r = 0; r < this.filas; r++) {
      const fila: Celda[] = [];
      for (let c = 0; c < this.cols; c++) fila.push(this.hoja.datos[this.fila - 1 + r]?.[this.col - 1 + c] ?? '');
      out.push(fila);
    }
    return out;
  }
  setValues(valores: Celda[][]): FakeRange {
    if (valores.length !== this.filas || valores.some((f) => f.length !== this.cols)) {
      throw new Error(`Dimensiones incorrectas: rango ${this.filas}x${this.cols}`);
    }
    valores.forEach((f, r) =>
      f.forEach((v, c) => {
        if (typeof v === 'string' && v.startsWith('=')) throw new Error('Se intentó escribir una fórmula');
        this.hoja.poner(this.fila + r, this.col + c, typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
      }),
    );
    return this;
  }
  setNumberFormat(): FakeRange {
    return this;
  }
  setFontWeight(): FakeRange {
    return this;
  }
  setBackground(): FakeRange {
    return this;
  }
}

export class FakeSheet {
  datos: Celda[][] = [];
  maxFilas = 1000;
  protecciones: unknown[] = [];
  congeladas = 0;
  constructor(public nombre: string) {}
  getName() {
    return this.nombre;
  }
  poner(fila: number, col: number, v: Celda) {
    while (this.datos.length < fila) this.datos.push([]);
    const f = this.datos[fila - 1];
    while (f.length < col) f.push('');
    f[col - 1] = v;
  }
  getLastRow() {
    for (let i = this.datos.length; i > 0; i--) if (this.datos[i - 1].some((v) => v !== '')) return i;
    return 0;
  }
  getLastColumn() {
    return this.datos.reduce((m, f) => {
      for (let i = f.length; i > 0; i--) if (f[i - 1] !== '') return Math.max(m, i);
      return m;
    }, 0);
  }
  getMaxRows() {
    return this.maxFilas;
  }
  insertRowsAfter(_despues: number, n: number) {
    this.maxFilas += n;
  }
  getRange(fila: number, col: number, filas = 1, cols = 1) {
    return new FakeRange(this, fila, col, filas, cols);
  }
  setFrozenRows(n: number) {
    this.congeladas = n;
  }
  setColumnWidth() {}
  getProtections() {
    return this.protecciones;
  }
  protect() {
    const p = { setDescription: () => p, setWarningOnly: () => p };
    this.protecciones.push(p);
    return p;
  }
  /** Tabla como objetos {titulo: valor}, para mirar en los tests. */
  tabla(): Record<string, Celda>[] {
    const [enc, ...filas] = this.datos;
    return filas
      .filter((f) => f.some((v) => v !== ''))
      .map((f) => Object.fromEntries(enc.map((t, i) => [String(t), f[i] ?? ''])));
  }
}

export class FakeSpreadsheet {
  hojas: FakeSheet[] = [new FakeSheet('Hoja 1')];
  getSheetByName(n: string) {
    return this.hojas.find((h) => h.nombre === n) ?? null;
  }
  insertSheet(n: string) {
    const h = new FakeSheet(n);
    this.hojas.push(h);
    return h;
  }
  getSheets() {
    return [...this.hojas];
  }
  deleteSheet(h: FakeSheet) {
    this.hojas = this.hojas.filter((x) => x !== h);
  }
}

export interface Entorno {
  globales: Record<string, unknown>;
  libro: FakeSpreadsheet;
  cache: Map<string, string>;
  propiedades: Map<string, string>;
  respuestasUi: string[];
  alertas: string[];
  lecturasPropiedades: number;
}

export function crearEntorno(): Entorno {
  const libro = new FakeSpreadsheet();
  const cache = new Map<string, string>();
  const propiedades = new Map<string, string>();
  const respuestasUi: string[] = [];
  const alertas: string[] = [];
  const ui = {
    Button: { OK: 'OK', CANCEL: 'CANCEL' },
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
    prompt: () => {
      const r = respuestasUi.shift();
      return { getSelectedButton: () => (r === undefined ? 'CANCEL' : 'OK'), getResponseText: () => r ?? '' };
    },
    alert: (_titulo: string, texto: string) => {
      alertas.push(texto);
    },
    createMenu: () => {
      const m = { addItem: () => m, addToUi: () => undefined };
      return m;
    },
  };
  const ent = { lecturasPropiedades: 0 } as Entorno;
  const globales: Record<string, unknown> = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => libro,
      flush: () => undefined,
      getUi: () => ui,
      ProtectionType: { SHEET: 'SHEET' },
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => void cache.set(k, v),
        remove: (k: string) => void cache.delete(k),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => {
          ent.lecturasPropiedades++;
          return propiedades.get(k) ?? null;
        },
        setProperty: (k: string, v: string) => void propiedades.set(k, v),
      }),
    },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Utilities: {
      getUuid: () => randomUUID(),
      newBlob: (s: string) => ({ getBytes: () => aBytes(Buffer.from(s, 'utf8')) }),
      computeHmacSha256Signature: (valor: string | number[], llave: string | number[]) =>
        aBytes(createHmac('sha256', aBuffer(llave)).update(aBuffer(valor)).digest()),
      formatDate: (d: Date, tz: string) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (s: string) => {
        const salida = { setMimeType: () => salida, getContent: () => s };
        return salida;
      },
    },
  };
  return Object.assign(ent, { globales, libro, cache, propiedades, respuestasUi, alertas });
}
