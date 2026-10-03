import { formatPeriod } from '../../engine';
import { DIVISIONS } from '../../domain/categories';
import { DATASET, FIRST_PERIOD, LAST_PERIOD } from '../../domain/data';
import { formatNumber } from '../../domain/format';
import { REGION_NAMES } from '../../domain/regions';
import { SourceBadge } from '../components';

export function Metodologia() {
  const w = DATASET.weights;
  const regions = ['gba', 'pampeana', 'nea', 'noa', 'cuyo', 'patagonia'] as const;
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">Metodología</span>
        <h1>Cómo calculamos cada número</h1>
        <p className="lede">Qué es dato oficial, qué es un cálculo de la app y qué es una estimación con tus datos.</p>
      </header>

      <div className="grid-2">
        <article className="card prose">
          <h2>Tres tipos de número</h2>
          <ul>
            <li><SourceBadge kind="oficial" /> Lo publica INDEC tal cual: el IPC y sus variaciones.</li>
            <li><SourceBadge kind="calculo" /> Una cuenta de la app con datos oficiales, por ejemplo un sueldo actualizado por IPC.</li>
            <li><SourceBadge kind="estimacion" /> Usa tus gastos. Es una estimación y no es un indicador oficial.</li>
            <li><SourceBadge kind="externo" /> Dato de otro organismo oficial (BCRA, institutos de estadística de CABA y provincias). Se identifica siempre.</li>
          </ul>

          <h2>Sueldo equivalente según INDEC</h2>
          <code className="formula">{'sueldo equivalente = sueldo × IPC(mes de comparación) ÷ IPC(mes del sueldo)\ninflación acumulada = IPC(fin) ÷ IPC(inicio) − 1'}</code>
          <p>Los índices ya están compuestos. Por eso la inflación de varios meses nunca se calcula sumando tasas: dos meses de 10% dan 21%, no 20%.</p>

          <h2>Inflación personal</h2>
          <p>Es el costo de tu canasta fija valuada con los índices oficiales de cada categoría en tu región (la misma familia de índices que usa el IPC):</p>
          <code className="formula">{'C(t) = Σ  pᵢ × Iᵢ(t) ÷ Iᵢ(b)\ninflación personal = C(fin) ÷ C(inicio) − 1'}</code>
          <p>Acá <em>pᵢ</em> es la parte de tu gasto en la categoría <em>i</em>, <em>Iᵢ</em> es su índice oficial y <em>b</em> es el mes al que corresponden tus montos. Ese mes importa: si cargás tus gastos de hoy, ya incluyen las subas pasadas, y valuarlos como si fueran del inicio inflaría lo que más subió.</p>
          <p>La inflación personal <strong>no</strong> se calcula con cuánto cambiaron tus gastos. Si gastaste más en comida, puede ser porque compraste más. El historial de gastos se mostrará como "variación de tu gasto", que es otra cosa.</p>

          <h2>Por qué tu inflación es distinta</h2>
          <code className="formula">{'diferencia = Σ (tu pesoᵢ − peso IPCᵢ) × (variaciónᵢ − variación promedio)'}</code>
          <p>Es una identidad exacta. Una categoría sube tu inflación si pesa más en tu canasta y aumentó más que el promedio, o si pesa menos y aumentó menos. Los pesos se miden al inicio del período.</p>

          <h2>Tu precio real (contratos y facturas)</h2>
          <p>En alquiler, expensas, luz/gas/agua, prepaga, colegio, universidad, internet y streaming podés cargar cuánto pagabas en otro mes. Entre esa fecha y la de tus montos, ese ítem varía exactamente lo que te aumentó (interpolación geométrica mes a mes). Antes y después, sigue al índice oficial de su categoría. Sirve, por ejemplo, si tu boleta de luz subió distinto que el promedio por tener o no subsidio.</p>

          <h2>IPC con la canasta 2017/18 (estimación)</h2>
          <p>El IPC oficial usa pesos de 2004/05. INDEC preparó una canasta con la encuesta 2017/18, donde vivienda y servicios pesan 14,5% (contra 9,4%) y transporte 14,3% (contra 11%), y la postergó. La app valúa esos pesos con los índices oficiales de cada división del total nacional, como canasta fija a precios de mayo de 2018:</p>
          <code className="formula">{'IPC canasta 2017/18 (t0→t1) = C(t1) / C(t0) − 1,  con pesos ENGHo 2017/18 y b = may-2018'}</code>
          <p>Hay 8 de 13 pesos publicados; el resto se prorratea. Es una estimación de la app, marcada como tal en todas las pantallas. Cuando INDEC publique la tabla completa se reemplaza.</p>

          <h2>IPC de la Ciudad y de las provincias</h2>
          <p>INDEC no publica inflación por provincia. La Ciudad de Buenos Aires (IPCBA) y algunas provincias tienen índice propio; la app usa los que publica como serie la API de Series de Tiempo: CABA, Córdoba, Mendoza, Neuquén, San Luis, Santa Fe, Tucumán y Chaco. Se muestran siempre con su organismo y como <em>fuente externa</em>: cada uno tiene su canasta, su base y, en general, mide solo la capital.</p>
          <p>El IPCBA tiene dos bases (jul-2011/jun-2012 y 2021). La serie se empalma en febrero de 2022, el mes que comparten: así se reproducen las cifras anuales publicadas. Si una serie tiene meses sin dato (Mendoza, 2012-2016), no se calcula a través del hueco.</p>

          <h2>Alquiler</h2>
          <code className="formula">{'IPC: alquiler nuevo = alquiler anterior × Π (1 + variación mensual publicada)\nICL: alquiler nuevo = alquiler anterior × ICL(día del ajuste) ÷ ICL(día del ajuste anterior)'}</code>
          <p>Con IPC se multiplican las variaciones de los últimos meses publicados al momento del ajuste (con rezago de 2 meses, un ajuste trimestral de agosto usa abril, mayo y junio). Se usan las variaciones con un decimal, como las difunde INDEC. El ICL son los valores diarios oficiales del BCRA.</p>

          <h2>Cuota UVA</h2>
          <code className="formula">{'cuota en pesos = cuota en UVA × UVA(día de pago)\nUVA(d) = UVA(d − 1) × (1 + IPC(m − 1))^(1 / días del mes m),  del 17 de m al 16 de m + 1'}</code>
          <p>Es la regla con la que el BCRA hace crecer la UVA. La app la verificó contra todos los cierres de mes publicados desde marzo de 2017 (diferencia máxima: un centavo, por redondeo) y la usa para calcular cualquier día hasta el 16 del mes siguiente al último IPC.</p>

          <h2>¿Le ganaste al promedio?</h2>
          <code className="formula">{'contra el promedio = (1 + tu aumento) ÷ (1 + aumento del índice de salarios) − 1'}</code>
          <p>El índice de salarios de INDEC (base octubre 2016) mide privados registrados, públicos y no registrados. El de no registrados tiene cinco meses de rezago.</p>

          <h2>Precios promedio (¿cuánto aumentó?)</h2>
          <code className="formula">{'variación = precio final ÷ precio inicial − 1\ncontra la inflación = (1 + variación) ÷ (1 + IPC de la región) − 1'}</code>
          <p>Son los precios promedio que INDEC publica con el IPC: 59 productos del Gran Buenos Aires (desde diciembre de 2016) y 14 de cada región (desde junio de 2017). INDEC advierte que comparar precios entre regiones puede no ser válido, porque las variedades no son las mismas: la app compara cada producto solo consigo mismo en el tiempo. La API de datos abiertos tiene errores en algunos meses (junio a agosto de 2023 en las regiones, julio de 2025 en Noreste y Noroeste, marzo de 2017 y 2026 en algunos productos de GBA); se reemplazan por las cifras de los informes de INDEC, y 550 precios se controlan contra esos informes en cada actualización.</p>
          <p>La jubilación mínima del mes que todavía no está en la serie oficial se calcula con la regla de movilidad: el haber del mes anterior por (1 + inflación de dos meses antes, con dos decimales). Reproduce al centavo todos los meses publicados desde mayo de 2024.</p>

          <h2>Canasta básica</h2>
          <p>La canasta básica total del hogar es la canasta por adulto equivalente de INDEC (Gran Buenos Aires) multiplicada por las unidades de adulto equivalente de cada integrante, según el cuadro de INDEC por sexo y edad. Así se reproducen exactamente los hogares tipo de sus informes.</p>

          <h2>Poder adquisitivo</h2>
          <code className="formula">{'variación real = (1 + aumento nominal) ÷ (1 + inflación) − 1'}</code>
          <p>No es "aumento menos inflación". Con un aumento de 80% y precios que suben 95%, la caída real es 1,80 ÷ 1,95 − 1 = −7,7%.</p>

          <h2>Límites de los datos</h2>
          <ul>
            <li>El IPC con cobertura nacional empieza en {formatPeriod(FIRST_PERIOD, 'long')}. Para fechas anteriores no hay una serie de INDEC comparable (2007-2015 fue declarado período de emergencia estadística); se puede usar el IPCBA (desde julio de 2012) o un índice provincial.</li>
            <li>INDEC publica 6 regiones: no hay IPC de INDEC por provincia, ciudad ni barrio. La provincia sirve para elegir la región y, donde existe, para ofrecer el índice provincial como alternativa.</li>
            <li>Con los datos actuales cada rubro se valúa con su división (12 categorías). No existe índice de productos puntuales como tofu o soja texturizada: se asignan a la categoría más cercana.</li>
            <li>El último dato es de {formatPeriod(LAST_PERIOD, 'long')}. El IPC de cada mes se publica a mediados del mes siguiente.</li>
            <li>La canasta del IPC sigue siendo la de la Encuesta de Gastos de los Hogares 2004/05. INDEC anunció una canasta nueva (2017/18) y la postergó sin fecha.</li>
          </ul>

          <h2>Privacidad</h2>
          <p>En esta versión no hay cuentas ni servidor: tus gastos y sueldos se guardan solo en este navegador y los podés borrar desde Mi situación.</p>
        </article>

        <aside className="stack">
          <section className="card stack">
            <h2 style={{ fontSize: 'var(--step-2)' }}>Ponderaciones del IPC</h2>
            <p className="small muted">Peso de cada división en la canasta de cada región, base diciembre 2016 (%). Fuente: INDEC.</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>División</th>{regions.map((r) => <th key={r} className="n">{REGION_NAMES[r].replace(/ \(.*\)/, '')}</th>)}</tr></thead>
                <tbody>
                  {DIVISIONS.map((d) => (
                    <tr key={d.id}><td>{d.short}</td>{regions.map((r) => <td key={r} className="n">{formatNumber(w[r][d.id], 1)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: 'var(--step-2)' }}>¿Qué significa?</h2>
            <dl className="prose small" style={{ margin: 0 }}>
              <dt><strong>Inflación</strong></dt><dd style={{ margin: 0 }}>La variación promedio de los precios de los bienes y servicios que considera el indicador.</dd>
              <dt><strong>Inflación personal</strong></dt><dd style={{ margin: 0 }}>Una estimación de cómo evolucionó el costo de tu propia estructura de consumo.</dd>
              <dt><strong>Poder adquisitivo</strong></dt><dd style={{ margin: 0 }}>Cuánto podés comprar con tus ingresos en comparación con otro momento.</dd>
              <dt><strong>Interanual</strong></dt><dd style={{ margin: 0 }}>Variación contra el mismo mes del año anterior.</dd>
              <dt><strong>Puntos porcentuales (p.p.)</strong></dt><dd style={{ margin: 0 }}>La resta entre dos porcentajes: 30% y 25% difieren en 5 p.p.</dd>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
