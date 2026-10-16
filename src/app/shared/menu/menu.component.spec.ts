/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AuthServiceService } from '../../services/auth-service.service';
import { MenuStateService } from '../../services/menu-state.service';
import { ThemeService } from '../../services/theme.service';
import { ThemeToggleComponent } from '../ui/theme-toggle/theme-toggle.component';
import { ToastService } from '../toast/toast.service';
import { MenuComponent } from './menu.component';

const CLAVES = ['finanzas-menu-colapsado', 'finanzas-menu-favoritos'];

describe('MenuComponent', () => {
  let fixture: ComponentFixture<MenuComponent>;
  let menu: MenuComponent;
  let estado: MenuStateService;
  let router: Router;
  let sesion: BehaviorSubject<boolean>;
  let auth: { isLoggedIn$: any; isAuthenticated: jasmine.Spy; logout: jasmine.Spy };
  let toast: { info: jasmine.Spy };

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector(sel) as HTMLElement | null;
  const qa = (sel: string) => Array.from(el().querySelectorAll(sel)) as HTMLElement[];
  const texto = (sel: string) => (q(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** Etiquetas visibles (sin el nombre del ícono de Material, que también es texto en el DOM). */
  const etiquetas = (sel: string) => qa(sel).map((e) => (e.querySelector('.item-etiqueta') ?? e.querySelector('span'))!.textContent!.trim());
  const refrescar = () => fixture.detectChanges();

  async function montar(ancho: number, url = '/aportes-carro', conSesion = true) {
    CLAVES.forEach((c) => localStorage.removeItem(c));
    sesion = new BehaviorSubject<boolean>(conSesion);
    auth = { isLoggedIn$: sesion.asObservable(), isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(of(true)), logout: jasmine.createSpy('logout') };
    toast = { info: jasmine.createSpy('info') };
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([{ path: '**', children: [] }])],
      declarations: [MenuComponent, ThemeToggleComponent],
      providers: [
        { provide: AuthServiceService, useValue: auth },
        { provide: ToastService, useValue: toast },
        ThemeService,
      ],
    }).compileComponents();
    TestBed.inject(ThemeService).animarCambios = false; // el cambio de tema es síncrono en las pruebas
    estado = TestBed.inject(MenuStateService);
    estado.fijarAncho(ancho);
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(MenuComponent);
    menu = fixture.componentInstance;
    refrescar();
  }

  afterEach(() => CLAVES.forEach((c) => localStorage.removeItem(c)));

  describe('sin sesión', () => {
    it('no hay menú: solo el cambio de tema', async () => {
      await montar(1280, '/login', false);
      expect(q('nav')).toBeNull();
      expect(q('.topbar')).toBeNull();
      expect(q('.tema-flotante')).not.toBeNull();
    });

    it('al iniciar sesión aparece la navegación', async () => {
      await montar(1280, '/login', false);
      sesion.next(true);
      refrescar();
      expect(q('nav.nav')).not.toBeNull();
    });
  });

  describe('escritorio (barra lateral)', () => {
    beforeEach(() => montar(1280));

    it('muestra favoritos, buscador y los 4 grupos, con solo el de la sección actual desplegado', () => {
      expect(menu.layout).toBe('sidebar');
      expect(etiquetas('.favoritos .fav')).toEqual(['Inicio', 'Compras', 'Movimientos', 'Personas']);
      expect(q('.buscador-input')).not.toBeNull();
      expect(qa('.grupo').length).toBe(5);
      expect(qa('.grupo.abierto').length).toBe(1);
      expect(texto('.grupo.abierto .grupo-nombre')).toBe('Pagos');
      expect(qa('.grupo-btn').map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false', 'false']);
    });

    it('la sección actual lleva aria-current y su grupo queda marcado', () => {
      const actual = q('.grupo .item.activo a');
      expect(actual?.querySelector('.item-etiqueta')?.textContent!.trim()).toBe('Aportes del carro');
      expect(actual?.getAttribute('aria-current')).toBe('page');
      expect(qa('[aria-current=page]').length).toBe(1);
      expect(q('.grupo--activo')).not.toBeNull();
    });

    it('abrir un grupo cierra el anterior (acordeón: nunca hace falta scroll)', () => {
      (qa('.grupo-btn')[2] as HTMLButtonElement).click(); // Dinero
      refrescar();
      expect(qa('.grupo.abierto').length).toBe(1);
      expect(texto('.grupo.abierto .grupo-nombre')).toBe('Dinero');
      (qa('.grupo-btn')[2] as HTMLButtonElement).click(); // volver a pulsarlo lo cierra
      refrescar();
      expect(qa('.grupo.abierto').length).toBe(0);
    });

    it('navegar a otra sección despliega su grupo', async () => {
      await router.navigateByUrl('/liquidacion');
      refrescar();
      expect(texto('.grupo.abierto .grupo-nombre')).toBe('Análisis');
      expect(q('.grupo .item.activo')?.textContent).toContain('Liquidación');
    });

    it('las pantallas de detalle mantienen la sección (/prestamos/7 → Préstamos)', async () => {
      await router.navigateByUrl('/prestamos/7');
      refrescar();
      expect(menu.activo?.item.id).toBe('prestamos');
      expect(texto('.grupo.abierto .grupo-nombre')).toBe('Compras y cobros');
    });

    it('colapsar pasa al modo compacto y recuerda la preferencia', () => {
      (qa('.nav-cabecera .icono-btn')[0] as HTMLButtonElement).click();
      refrescar();
      expect(menu.layout).toBe('rail');
      expect(q('.nav--compacto')).not.toBeNull();
      expect(localStorage.getItem('finanzas-menu-colapsado')).toBe('true');
    });
  });

  describe('búsqueda', () => {
    beforeEach(() => montar(1280));
    const escribir = (valor: string) => {
      const input = q('.buscador-input') as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      refrescar();
    };
    const tecla = (key: string) => {
      (q('.buscador-input') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      refrescar();
    };

    it('muestra una lista plana ordenada por relevancia, con el grupo de cada resultado', () => {
      escribir('carro');
      expect(qa('.resultados .item').map((i) => i.querySelector('.item-etiqueta')!.textContent)).toEqual(['Aportes del carro', 'Obligaciones']);
      expect(texto('.resultados .item .item-grupo')).toBe('Pagos');
      expect(q('.grupos')).toBeNull();
      expect(q('.favoritos')).toBeNull();
    });

    it('sin coincidencias avisa', () => {
      escribir('zzzz');
      expect(texto('.sin-resultados')).toContain('Ninguna sección coincide con «zzzz»');
    });

    it('las flechas recorren los resultados y Enter abre el elegido', async () => {
      escribir('pag');
      expect(qa('.resultados .item.resultado').length).toBe(1);
      expect(texto('.resultados .item.resultado .item-etiqueta')).toBe('Pagos del mes');
      tecla('ArrowDown');
      expect(texto('.resultados .item.resultado .item-etiqueta')).toBe('Pagos por persona');
      tecla('ArrowUp');
      tecla('ArrowUp'); // da la vuelta al final de la lista
      expect(menu.indiceResultado).toBe(menu['resultados'].length - 1);
      tecla('ArrowDown');
      tecla('ArrowDown');
      tecla('Enter');
      await fixture.whenStable();
      expect(router.url).toBe('/pagos-mes-personas');
    });

    it('Esc limpia la búsqueda y volver a navegar también', async () => {
      escribir('carro');
      tecla('Escape');
      expect(menu.consulta).toBe('');
      expect(q('.grupos')).not.toBeNull();

      escribir('carro');
      await router.navigateByUrl('/cuentas');
      refrescar();
      expect(menu.consulta).toBe('');
    });

    it('el botón de limpiar vacía el buscador', () => {
      escribir('carro');
      (q('.buscador-limpiar') as HTMLButtonElement).click();
      refrescar();
      expect(menu.consulta).toBe('');
      expect(q('.buscador-limpiar')).toBeNull();
    });

    it('Ctrl+K lleva el cursor al buscador', (hecho) => {
      document.body.appendChild(el());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
      setTimeout(() => {
        expect(document.activeElement).toBe(q('.buscador-input'));
        el().remove();
        hecho();
      }, 80);
    });
  });

  describe('favoritos', () => {
    beforeEach(() => montar(1280));

    it('fijar una sección la añade a Favoritos y recuerda la elección', () => {
      const estrella = qa('.grupo .item-fav').find((b) => b.getAttribute('aria-label')!.includes('Obligaciones'))!;
      expect(estrella.getAttribute('aria-pressed')).toBe('false');
      // los 4 huecos están ocupados: primero se quita uno
      (qa('.favoritos .fav-quitar')[0] as HTMLButtonElement).click();
      refrescar();
      expect(qa('.favoritos .fav').length).toBe(3);
      qa('.grupo .item-fav').find((b) => b.getAttribute('aria-label')!.includes('Obligaciones'))!.click();
      refrescar();
      expect(etiquetas('.favoritos .fav')).toContain('Obligaciones');
      expect(JSON.parse(localStorage.getItem('finanzas-menu-favoritos')!)).toContain('obligaciones');
    });

    it('con los 4 huecos ocupados avisa en vez de fijar', () => {
      qa('.grupo .item-fav').find((b) => b.getAttribute('aria-label')!.includes('Obligaciones'))!.click();
      expect(toast.info).toHaveBeenCalledWith(jasmine.stringMatching(/Ya tienes 4 favoritos/));
      expect(menu.favoritos.length).toBe(4);
    });

    it('la estrella no navega (no dispara el enlace)', async () => {
      (qa('.favoritos .fav-quitar')[0] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(router.url).toBe('/aportes-carro');
    });
  });

  describe('modo compacto', () => {
    beforeEach(async () => {
      await montar(1280);
      estado.fijarColapsado(true);
      refrescar();
    });

    it('muestra un botón por grupo y marca el de la sección actual', () => {
      expect(menu.layout).toBe('rail');
      expect(qa('.rail-grupo').length).toBe(5);
      expect(qa('.rail-grupo').map((b) => b.getAttribute('aria-label'))).toEqual(['Inicio', 'Compras y cobros', 'Pagos', 'Dinero', 'Análisis']);
      expect(qa('.rail-grupo.activo').length).toBe(1);
      expect(q('.buscador-input')).toBeNull(); // el buscador es un botón de ícono
      expect(q('.rail-btn[aria-label^="Buscar"]')).not.toBeNull();
    });

    it('un grupo abre un menú emergente con sus secciones; Esc y el clic fuera lo cierran', () => {
      (qa('.rail-grupo')[3] as HTMLButtonElement).click();
      refrescar();
      expect(texto('.flyout .flyout-titulo')).toBe('Dinero');
      expect(qa('.flyout .item').map((i) => i.querySelector('.item-etiqueta')!.textContent)).toEqual(['Cuentas', 'Categorías', 'Transacciones', 'Correos']);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      refrescar();
      expect(q('.flyout')).toBeNull();

      (qa('.rail-grupo')[1] as HTMLButtonElement).click();
      refrescar();
      expect(q('.flyout')).not.toBeNull();
      document.body.click();
      refrescar();
      expect(q('.flyout')).toBeNull();
    });

    it('volver a pulsar el mismo grupo cierra el menú emergente', () => {
      const boton = qa('.rail-grupo')[1] as HTMLButtonElement;
      boton.click();
      refrescar();
      boton.click();
      refrescar();
      expect(q('.flyout')).toBeNull();
    });

    it('elegir una sección navega y cierra el menú emergente', async () => {
      (qa('.rail-grupo')[4] as HTMLButtonElement).click();
      refrescar();
      (qa('.flyout .item-enlace')[2] as HTMLAnchorElement).click();
      await fixture.whenStable();
      refrescar();
      expect(router.url).toBe('/liquidacion');
      expect(q('.flyout')).toBeNull();
    });

    it('el botón de ícono de búsqueda expande la barra', () => {
      (q('.rail-btn[aria-label^="Buscar"]') as HTMLButtonElement).click();
      refrescar();
      expect(menu.layout).toBe('sidebar');
    });
  });

  describe('tablet (panel deslizable)', () => {
    beforeEach(() => montar(820));

    it('barra superior con la sección actual y panel cerrado (oculto a lectores de pantalla)', () => {
      expect(menu.layout).toBe('drawer');
      expect(texto('.topbar-seccion')).toBe('Aportes del carro');
      expect(q('.barra-inferior')).toBeNull();
      expect(q('nav.nav')!.getAttribute('aria-hidden')).toBe('true');
      expect(q('.nav.abierto')).toBeNull();
    });

    it('la hamburguesa abre el panel y la tecla Esc, el velo o navegar lo cierran', async () => {
      (q('.topbar .icono-btn') as HTMLButtonElement).click();
      refrescar();
      expect(q('.nav.abierto')).not.toBeNull();
      expect(q('.velo.visible')).not.toBeNull();
      expect(q('nav.nav')!.getAttribute('aria-hidden')).toBeNull();
      expect(q('.topbar .icono-btn')!.getAttribute('aria-expanded')).toBe('true');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      refrescar();
      expect(q('.nav.abierto')).toBeNull();

      menu.abrirDrawer();
      refrescar();
      (q('.velo') as HTMLElement).click();
      refrescar();
      expect(q('.nav.abierto')).toBeNull();

      menu.abrirDrawer();
      refrescar();
      await router.navigateByUrl('/correos');
      refrescar();
      expect(q('.nav.abierto')).toBeNull();
      expect(texto('.topbar-seccion')).toBe('Correos');
    });

    it('pulsar la sección actual también cierra el panel', () => {
      menu.abrirDrawer();
      refrescar();
      (q('.grupo .item.activo a') as HTMLAnchorElement).click();
      refrescar();
      expect(menu.drawerAbierto).toBe(false);
    });

    it('deslizar hacia la izquierda cierra el panel; un toque corto o vertical, no', () => {
      menu.abrirDrawer();
      refrescar();
      const toque = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] }) as unknown as TouchEvent;
      menu.inicioTactil(toque(200, 300));
      menu.finTactil(toque(180, 300));
      expect(menu.drawerAbierto).toBe(true);
      menu.inicioTactil(toque(200, 300));
      menu.finTactil(toque(100, 420));
      expect(menu.drawerAbierto).toBe(true);
      menu.inicioTactil(toque(200, 300));
      menu.finTactil(toque(100, 310));
      expect(menu.drawerAbierto).toBe(false);
    });

    it('con el panel abierto el foco da la vuelta (Tab en el último vuelve al primero)', () => {
      document.body.appendChild(el());
      menu.abrirDrawer();
      refrescar();
      const enfocables = Array.from(el().querySelectorAll('.nav a[href], .nav button:not([disabled]), .nav input')) as HTMLElement[];
      const visibles = enfocables.filter((e) => e.offsetParent !== null);
      visibles[visibles.length - 1].focus();
      const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      menu.teclaPanel(evento);
      expect(evento.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(visibles[0]);
      el().remove();
    });

    it('el botón de buscar abre el panel', () => {
      (qa('.topbar .icono-btn')[1] as HTMLButtonElement).click();
      refrescar();
      expect(menu.drawerAbierto).toBe(true);
    });
  });

  describe('móvil', () => {
    beforeEach(() => montar(390));

    it('barra inferior con los 4 favoritos (etiquetas cortas) y «Más»', () => {
      expect(menu.layout).toBe('movil');
      expect(etiquetas('.barra-inferior .barra-item')).toEqual(['Inicio', 'Compras', 'Movimientos', 'Personas', 'Más']);
      expect(q('.topbar')).not.toBeNull();
    });

    it('si la sección actual no es un favorito, «Más» se marca como activo', () => {
      expect(q('.barra-inferior button.barra-item')!.classList).toContain('activo'); // /aportes-carro no está fijada
    });

    it('un favorito activo se resalta y «Más» no', async () => {
      await router.navigateByUrl('/transacciones');
      refrescar();
      expect(etiquetas('.barra-inferior a.activo')).toEqual(['Movimientos']);
      expect(q('.barra-inferior button.barra-item')!.classList).not.toContain('activo');
    });

    it('«Más» abre el panel con todas las secciones', () => {
      (q('.barra-inferior button.barra-item') as HTMLButtonElement).click();
      refrescar();
      expect(menu.drawerAbierto).toBe(true);
      expect(qa('.nav .grupo').length).toBe(5);
    });

    it('al ensanchar la ventana la barra inferior desaparece y aparece la lateral', () => {
      estado.fijarAncho(1280);
      refrescar();
      expect(q('.barra-inferior')).toBeNull();
      expect(q('.topbar')).toBeNull();
      expect(menu.layout).toBe('sidebar');
    });
  });

  describe('tema y sesión', () => {
    it('cerrar sesión llama al servicio y cierra el panel', async () => {
      await montar(390);
      menu.abrirDrawer();
      refrescar();
      (q('.pie-btn--salir') as HTMLButtonElement).click();
      expect(auth.logout).toHaveBeenCalled();
      expect(menu.drawerAbierto).toBe(false);
    });

    it('el selector de tema cambia entre claro y oscuro y se valida el token al iniciar', async () => {
      await montar(1280);
      expect(auth.isAuthenticated).toHaveBeenCalled();
      expect(q('app-theme-toggle .erp-segmented')).not.toBeNull();
      (q('app-theme-toggle .erp-segmented__item[aria-label="Claro"]') as HTMLButtonElement).click();
      refrescar();
      expect(menu.isDarkTheme).toBe(false);
      (q('app-theme-toggle .erp-segmented__item[aria-label="Oscuro"]') as HTMLButtonElement).click();
      refrescar();
      expect(menu.isDarkTheme).toBe(true);
    });
  });
});
