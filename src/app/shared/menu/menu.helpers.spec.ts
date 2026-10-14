import { routes } from '../../app-routing.module';
import { FAVORITOS_POR_DEFECTO, GRUPOS_MENU, MAX_FAVORITOS } from './menu.config';
import { aplanar, alternarFavorito, buscar, buscarItem, etiquetaCorta, itemActivo, itemsFavoritos, normalizar, resolverFavoritos } from './menu.helpers';

const id = (r: ReturnType<typeof buscar>) => r.map((x) => x.item.id);

describe('Configuración del menú', () => {
  const items = aplanar(GRUPOS_MENU).map((x) => x.item);

  it('los ids y las rutas son únicos y las rutas empiezan por /', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.ruta)).size).toBe(items.length);
    expect(new Set(GRUPOS_MENU.map((g) => g.id)).size).toBe(GRUPOS_MENU.length);
    for (const i of items) expect(i.ruta.startsWith('/')).toBe(true);
  });

  it('cada enlace del menú (y sus rutas relacionadas) existe en el enrutador', () => {
    const paths = routes.map((r) => r.path);
    for (const i of items) {
      for (const ruta of [i.ruta, ...(i.relacionadas ?? [])]) {
        const base = ruta.slice(1);
        expect(paths.some((p) => p === base || p?.startsWith(`${base}/`))).withContext(`${i.etiqueta}: ${ruta}`).toBe(true);
      }
    }
  });

  it('los favoritos por defecto existen y caben en la barra inferior', () => {
    expect(FAVORITOS_POR_DEFECTO.length).toBeLessThanOrEqual(MAX_FAVORITOS);
    for (const f of FAVORITOS_POR_DEFECTO) expect(buscarItem(GRUPOS_MENU, f)).not.toBeNull();
  });

  it('cada grupo tiene ícono y al menos un ítem', () => {
    for (const g of GRUPOS_MENU) {
      expect(g.icono).toBeTruthy();
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizar', () => {
  it('quita tildes y mayúsculas y recorta', () => {
    expect(normalizar('  Liquidación ')).toBe('liquidacion');
    expect(normalizar('AÑO Ünico')).toBe('ano unico');
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('itemActivo', () => {
  const activo = (url: string) => itemActivo(GRUPOS_MENU, url)?.item.id ?? null;

  it('una ruta exacta o con subruta pertenece a su sección', () => {
    expect(activo('/prestamos')).toBe('prestamos');
    expect(activo('/prestamos/7')).toBe('prestamos');
    expect(activo('/obligaciones/3?x=1#a')).toBe('obligaciones');
    expect(activo('/aportes-carro/')).toBe('aportes-carro');
  });

  it('no confunde rutas que comparten prefijo de texto (pagos-mes ≠ pagos-mes-personas)', () => {
    expect(activo('/pagos-mes')).toBe('pagos-mes');
    expect(activo('/pagos-mes/5')).toBe('pagos-mes');
    expect(activo('/pagos-mes-personas')).toBe('pagos-persona');
    expect(activo('/pagos-mes-personas-detalle/3')).toBe('pagos-persona');
  });

  it('las pantallas de detalle mantienen resaltada su sección', () => {
    expect(activo('/compra-credito-detalle/9')).toBe('compras-credito');
    expect(activo('/cruces-deuda')).toBe('estado-cuenta');
  });

  it('sin coincidencia no hay sección activa', () => {
    expect(activo('/')).toBeNull();
    expect(activo('/login')).toBeNull();
    expect(activo('/inexistente')).toBeNull();
  });

  it('devuelve también el grupo (para desplegarlo)', () => {
    expect(itemActivo(GRUPOS_MENU, '/liquidacion')?.grupo.id).toBe('analisis');
    expect(itemActivo(GRUPOS_MENU, '/categorias')?.grupo.id).toBe('dinero');
  });
});

describe('buscar', () => {
  it('consulta vacía → sin resultados (se muestran los grupos)', () => {
    expect(buscar(GRUPOS_MENU, '')).toEqual([]);
    expect(buscar(GRUPOS_MENU, '   ')).toEqual([]);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(id(buscar(GRUPOS_MENU, 'liquidacion'))[0]).toBe('liquidacion');
    expect(id(buscar(GRUPOS_MENU, 'LIQUIDACIÓN'))[0]).toBe('liquidacion');
    expect(id(buscar(GRUPOS_MENU, 'prestamos'))[0]).toBe('prestamos');
  });

  it('lo que empieza por la palabra va antes que lo que solo la menciona en sus palabras clave', () => {
    const r = id(buscar(GRUPOS_MENU, 'carro'));
    expect(r[0]).toBe('aportes-carro');
    expect(r).toContain('obligaciones'); // «carro» está en sus palabras clave
    expect(r.indexOf('aportes-carro')).toBeLessThan(r.indexOf('obligaciones'));
  });

  it('todas las palabras deben coincidir, en cualquier orden', () => {
    expect(id(buscar(GRUPOS_MENU, 'estado cuenta'))).toEqual(['estado-cuenta']);
    expect(id(buscar(GRUPOS_MENU, 'cuenta estado'))).toEqual(['estado-cuenta']);
    expect(buscar(GRUPOS_MENU, 'estado zzz')).toEqual([]);
  });

  it('reconoce palabras clave y el nombre del grupo', () => {
    expect(id(buscar(GRUPOS_MENU, 'nequi'))).toContain('cuentas');
    expect(id(buscar(GRUPOS_MENU, 'bancolombia'))).toContain('correos');
    expect(id(buscar(GRUPOS_MENU, 'movimientos'))).toContain('transacciones');
    expect(id(buscar(GRUPOS_MENU, 'dinero'))).toEqual(['cuentas', 'categorias', 'transacciones', 'correos']);
  });

  it('a igual relevancia respeta el orden del menú; una coincidencia exacta gana', () => {
    const r = id(buscar(GRUPOS_MENU, 'pag'));
    expect(r.slice(0, 2)).toEqual(['pagos-mes', 'pagos-persona']);
    expect(id(buscar(GRUPOS_MENU, 'cuentas'))[0]).toBe('cuentas');
  });

  it('sin coincidencias → vacío', () => {
    expect(buscar(GRUPOS_MENU, 'zzzz')).toEqual([]);
  });

  it('cada resultado trae su grupo', () => {
    const [primero] = buscar(GRUPOS_MENU, 'aportes carro');
    expect(primero.grupo.titulo).toBe('Pagos');
  });
});

describe('favoritos', () => {
  it('sin nada guardado usa los de por defecto', () => {
    expect(resolverFavoritos(undefined, GRUPOS_MENU)).toEqual(FAVORITOS_POR_DEFECTO);
    expect(resolverFavoritos('texto', GRUPOS_MENU)).toEqual(FAVORITOS_POR_DEFECTO);
    expect(resolverFavoritos(null, GRUPOS_MENU)).toEqual(FAVORITOS_POR_DEFECTO);
  });

  it('descarta ids que ya no existen, repetidos y lo que sobre del máximo', () => {
    expect(resolverFavoritos(['prestamos', 'ya-no-existe', 'prestamos', 'cuentas', 7], GRUPOS_MENU)).toEqual(['prestamos', 'cuentas']);
    expect(resolverFavoritos(['cuentas', 'correos', 'extractos', 'tarjetas', 'prestamos', 'liquidacion'], GRUPOS_MENU).length).toBe(MAX_FAVORITOS);
  });

  it('una lista vacía guardada se respeta (la persona quitó todos)', () => {
    expect(resolverFavoritos([], GRUPOS_MENU)).toEqual([]);
  });

  it('fijar, quitar y respetar el máximo', () => {
    expect(alternarFavorito([], 'cuentas')).toEqual({ favoritos: ['cuentas'], lleno: false });
    expect(alternarFavorito(['cuentas', 'correos'], 'cuentas')).toEqual({ favoritos: ['correos'], lleno: false });
    const llenos = ['a', 'b', 'c', 'd'];
    const r = alternarFavorito(llenos, 'e');
    expect(r.lleno).toBe(true);
    expect(r.favoritos).toBe(llenos); // sin cambios
    expect(alternarFavorito(llenos, 'd').favoritos).toEqual(['a', 'b', 'c']); // quitar con la lista llena sí se puede
  });

  it('los favoritos como ítems conservan el orden en que se fijaron', () => {
    expect(itemsFavoritos(GRUPOS_MENU, ['liquidacion', 'prestamos', 'no-existe']).map((x) => x.item.id)).toEqual(['liquidacion', 'prestamos']);
  });

  it('etiqueta corta de la barra inferior', () => {
    expect(etiquetaCorta(buscarItem(GRUPOS_MENU, 'transacciones')!.item)).toBe('Movimientos');
    expect(etiquetaCorta(buscarItem(GRUPOS_MENU, 'prestamos')!.item)).toBe('Préstamos'); // sin corta: la misma
  });
});
