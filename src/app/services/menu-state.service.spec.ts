import { BehaviorSubject } from 'rxjs';
import { FAVORITOS_POR_DEFECTO } from '../shared/menu/menu.config';
import { AuthServiceService } from './auth-service.service';
import { BP_ESCRITORIO, BP_MOVIL, LayoutMenu, MenuStateService, esRutaPublica, layoutPara } from './menu-state.service';

const CLAVES = ['finanzas-menu-colapsado', 'finanzas-menu-favoritos'];
const limpiar = () => CLAVES.forEach((c) => localStorage.removeItem(c));

describe('páginas públicas (enlace de cobro)', () => {
  it('solo /p/<token> es público', () => {
    expect(esRutaPublica('/p/abc123')).toBeTrue();
    expect(esRutaPublica('/p/abc123?x=1')).toBeTrue();
    expect(esRutaPublica('/p/')).toBeFalse();
    expect(esRutaPublica('/p')).toBeFalse();
    expect(esRutaPublica('/cobros')).toBeFalse();
    expect(esRutaPublica('/prestamos/7')).toBeFalse();
    expect(esRutaPublica(null)).toBeFalse();
  });

  it('en una página pública no hay menú aunque haya sesión, en cualquier ancho', () => {
    for (const ancho of [320, 800, 1920]) expect(layoutPara(ancho, false, true, true)).toBe('invitado');
    expect(layoutPara(1280, false, true, false)).toBe('sidebar');
  });
});

describe('layoutPara', () => {
  it('sin sesión no hay menú, sea cual sea el ancho', () => {
    for (const ancho of [320, 800, 1920]) expect(layoutPara(ancho, false, false)).toBe('invitado');
  });

  it('según el ancho: móvil < 768 ≤ tablet < 1024 ≤ escritorio', () => {
    expect(layoutPara(BP_MOVIL - 1, false, true)).toBe('movil');
    expect(layoutPara(BP_MOVIL, false, true)).toBe('drawer');
    expect(layoutPara(BP_ESCRITORIO - 1, false, true)).toBe('drawer');
    expect(layoutPara(BP_ESCRITORIO, false, true)).toBe('sidebar');
  });

  it('colapsar solo afecta al escritorio', () => {
    expect(layoutPara(1280, true, true)).toBe('rail');
    expect(layoutPara(900, true, true)).toBe('drawer');
    expect(layoutPara(390, true, true)).toBe('movil');
  });
});

describe('MenuStateService', () => {
  let sesion: BehaviorSubject<boolean>;
  let servicios: MenuStateService[] = [];

  function crear(): MenuStateService {
    const s = new MenuStateService({ isLoggedIn$: sesion.asObservable() } as unknown as AuthServiceService);
    servicios.push(s);
    return s;
  }
  const layoutDe = (s: MenuStateService): LayoutMenu => {
    let l!: LayoutMenu;
    s.layout$.subscribe((v) => (l = v)).unsubscribe();
    return l;
  };

  beforeEach(() => {
    limpiar();
    sesion = new BehaviorSubject<boolean>(true);
    servicios = [];
  });
  afterEach(() => {
    servicios.forEach((s) => s.ngOnDestroy());
    limpiar();
  });

  it('el layout reacciona al ancho, al colapso y a la sesión', () => {
    const s = crear();
    s.fijarAncho(1440);
    expect(layoutDe(s)).toBe('sidebar');
    s.alternarColapsado();
    expect(layoutDe(s)).toBe('rail');
    s.fijarAncho(900);
    expect(layoutDe(s)).toBe('drawer');
    s.fijarAncho(390);
    expect(layoutDe(s)).toBe('movil');
    sesion.next(false);
    expect(layoutDe(s)).toBe('invitado');
  });

  it('un cambio de tamaño de la ventana actualiza el ancho', () => {
    const s = crear();
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(500);
    window.dispatchEvent(new Event('resize'));
    expect(layoutDe(s)).toBe('movil');
  });

  it('recuerda si la barra está colapsada entre sesiones', () => {
    const a = crear();
    a.fijarAncho(1440);
    expect(a.colapsado$.value).toBe(false);
    a.alternarColapsado();
    const b = crear();
    b.fijarAncho(1440);
    expect(b.colapsado$.value).toBe(true);
    expect(layoutDe(b)).toBe('rail');
    b.alternarColapsado();
    expect(crear().colapsado$.value).toBe(false);
  });

  it('el panel se abre y se cierra, y se cierra solo al pasar a escritorio o cerrar sesión', () => {
    const s = crear();
    s.fijarAncho(390);
    s.abrirDrawer();
    expect(s.drawerAbierto$.value).toBe(true);
    s.cerrarDrawer();
    expect(s.drawerAbierto$.value).toBe(false);

    s.abrirDrawer();
    s.fijarAncho(1440);
    expect(s.drawerAbierto$.value).toBe(false);

    s.fijarAncho(390);
    s.abrirDrawer();
    sesion.next(false);
    expect(s.drawerAbierto$.value).toBe(false);
  });

  it('favoritos: por defecto, fijar, quitar, persistir y respetar el máximo', () => {
    const s = crear();
    expect(s.favoritos$.value).toEqual(FAVORITOS_POR_DEFECTO);
    expect(s.alternarFavorito('prestamos').favoritos).toEqual(['compras-credito', 'transacciones', 'liquidacion']);
    expect(s.alternarFavorito('cuentas')).toEqual({ favoritos: ['compras-credito', 'transacciones', 'liquidacion', 'cuentas'], lleno: false });
    expect(s.alternarFavorito('correos').lleno).toBe(true);
    expect(s.favoritos$.value.length).toBe(4);
    expect(crear().favoritos$.value).toEqual(['compras-credito', 'transacciones', 'liquidacion', 'cuentas']); // persistido
  });

  it('un valor corrupto en el almacenamiento se ignora y se usan los de por defecto', () => {
    localStorage.setItem('finanzas-menu-favoritos', '{no es json');
    localStorage.setItem('finanzas-menu-colapsado', 'tampoco');
    const s = crear();
    expect(s.favoritos$.value).toEqual(FAVORITOS_POR_DEFECTO);
    expect(s.colapsado$.value).toBe(false);
  });

  it('sin almacenamiento disponible (modo privado) la preferencia vale para la sesión y no falla', () => {
    const s = crear();
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    expect(() => s.alternarColapsado()).not.toThrow();
    expect(s.colapsado$.value).toBe(true);
    s.alternarFavorito('prestamos'); // libera un hueco (los 4 por defecto están ocupados)
    expect(() => s.alternarFavorito('cuentas')).not.toThrow();
    expect(s.favoritos$.value).toContain('cuentas');
  });
});
