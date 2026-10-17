import { ComprobanteEnvio } from '../modelos/cobros-personas';

/** El backend rechaza archivos de más de ~2.4 MB ya decodificados; se deja margen. */
export const MAX_BYTES_COMPROBANTE = 2_200_000;
/** Lado mayor al que se reducen las fotos (un comprobante se lee perfecto a 1600 px). */
export const LADO_MAX_IMAGEN = 1600;

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

/** ¿Es un tipo que se puede adjuntar como comprobante (foto o PDF)? */
export function tipoPermitido(tipo: string | null | undefined): boolean {
  return !!tipo && (TIPOS_IMAGEN.includes(tipo) || tipo === 'application/pdf');
}

/** Reduce proporcionalmente para que el lado mayor no pase de `maximo` (nunca agranda). */
export function escalarDimensiones(ancho: number, alto: number, maximo = LADO_MAX_IMAGEN): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 1, alto: 1 };
  const mayor = Math.max(ancho, alto);
  if (mayor <= maximo) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  const f = maximo / mayor;
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) };
}

/** `1_258_291` → `1.2 MB`; `48_000` → `47 KB`. */
export function tamanoLegible(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/** Bytes que ocupa un base64 una vez decodificado. */
export function bytesDeBase64(base64: string): number {
  const limpio = base64.replace(/\s+/g, '');
  const relleno = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
  return Math.floor((limpio.length * 3) / 4) - relleno;
}

function leerComoBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const resultado = String(lector.result ?? '');
      resolver(resultado.slice(resultado.indexOf(',') + 1));
    };
    lector.readAsDataURL(blob);
  });
}

function cargarImagen(archivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo abrir la imagen. Prueba con otra foto o con un PDF.'));
    };
    img.src = url;
  });
}

/**
 * Deja el archivo listo para enviar. Las fotos se reducen y se guardan como JPEG (una foto de celular de 5 MB queda en unos
 * 300 KB); los PDF se envían tal cual si caben. Lanza un `Error` con un mensaje para mostrar al usuario.
 */
export async function prepararComprobante(archivo: File): Promise<ComprobanteEnvio> {
  if (!tipoPermitido(archivo.type)) throw new Error('Adjunta una foto (JPG, PNG o WebP) o un PDF.');

  if (archivo.type === 'application/pdf') {
    if (archivo.size > MAX_BYTES_COMPROBANTE) throw new Error(`El PDF pesa ${tamanoLegible(archivo.size)} y el máximo es ${tamanoLegible(MAX_BYTES_COMPROBANTE)}. Envía una captura de pantalla en su lugar.`);
    return { nombre: archivo.name, tipo: 'application/pdf', datos: await leerComoBase64(archivo) };
  }

  const imagen = await cargarImagen(archivo);
  const { ancho, alto } = escalarDimensiones(imagen.naturalWidth, imagen.naturalHeight);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Tu navegador no pudo procesar la imagen.');
  contexto.fillStyle = '#ffffff'; // los PNG con transparencia no quedan negros en JPEG
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  for (const calidad of [0.82, 0.65, 0.5, 0.35]) {
    const dataUrl = lienzo.toDataURL('image/jpeg', calidad);
    const datos = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (bytesDeBase64(datos) <= MAX_BYTES_COMPROBANTE) {
      return { nombre: archivo.name.replace(/\.[^.]+$/, '') + '.jpg', tipo: 'image/jpeg', datos };
    }
  }
  throw new Error('La imagen sigue siendo demasiado pesada. Prueba con una captura de pantalla del comprobante.');
}

/** El backend acepta un QR de hasta 400 KB; se deja margen. */
export const MAX_BYTES_QR = 380_000;
/** Un QR se reduce menos que una foto (necesita bordes nítidos para que lo lea la cámara). */
export const LADO_MAX_QR = 900;

/**
 * Prepara la imagen del QR de un medio de pago: solo imágenes, a lo sumo 900 px de lado, en PNG (bordes nítidos) o, si pesa
 * demasiado, en JPEG. Lanza un `Error` con un mensaje para mostrar al usuario.
 */
export async function prepararQr(archivo: File): Promise<ComprobanteEnvio> {
  if (!TIPOS_IMAGEN.includes(archivo.type)) throw new Error('El QR debe ser una imagen (JPG, PNG o WebP).');
  const imagen = await cargarImagen(archivo);
  const { ancho, alto } = escalarDimensiones(imagen.naturalWidth, imagen.naturalHeight, LADO_MAX_QR);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Tu navegador no pudo procesar la imagen.');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const nombre = archivo.name.replace(/\.[^.]+$/, '');
  const png = lienzo.toDataURL('image/png');
  const datosPng = png.slice(png.indexOf(',') + 1);
  if (bytesDeBase64(datosPng) <= MAX_BYTES_QR) return { nombre: `${nombre}.png`, tipo: 'image/png', datos: datosPng };
  for (const calidad of [0.92, 0.8, 0.65]) {
    const jpeg = lienzo.toDataURL('image/jpeg', calidad);
    const datos = jpeg.slice(jpeg.indexOf(',') + 1);
    if (bytesDeBase64(datos) <= MAX_BYTES_QR) return { nombre: `${nombre}.jpg`, tipo: 'image/jpeg', datos };
  }
  throw new Error('La imagen del QR pesa demasiado. Recórtala para que solo se vea el código.');
}
