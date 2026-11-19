/* =====================================================
   SAFARI DE SEÑAS · Lógica del juego
   Tres fases: 1) Aprender  2) Reglas  3) Expedición
   ===================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------
     1. LISTA OFICIAL DE ANIMALES
     Es la ÚNICA fuente de animales del proyecto.
     Para cada animal, el sistema deduce solo los nombres de sus archivos:
        recursos/senas/sena-<nombre>.gif
        recursos/animales/<nombre>.png
     (en minúsculas, sin tildes ni eñes, con guiones en vez de espacios)
     --------------------------------------------------- */
  const LISTA_OFICIAL = [
    { nombre: 'ANIMALES',   articulo: 'los', soloDiccionario: true },   // solo en el diccionario, no entra al juego
    { nombre: 'ARAÑA',      articulo: 'una' },
    { nombre: 'BALLENA',    articulo: 'una' },
    { nombre: 'BURRO',      articulo: 'un'  },
    { nombre: 'CABALLO',    articulo: 'un'  },
    { nombre: 'CABRA',      articulo: 'una' },
    { nombre: 'CAMELLO',    articulo: 'un'  },
    { nombre: 'CANGREJO',   articulo: 'un'  },
    { nombre: 'CANGURO',    articulo: 'un'  },
    { nombre: 'CARACOL',    articulo: 'un'  },
    { nombre: 'CERDO',      articulo: 'un'  },
    { nombre: 'COCODRILO',  articulo: 'un'  },
    { nombre: 'CONEJO',     articulo: 'un'  },
    { nombre: 'CUCARACHA',  articulo: 'una' },
    { nombre: 'CULEBRA',    articulo: 'una' },
    { nombre: 'ELEFANTE',   articulo: 'un'  },
    { nombre: 'GALLINA',    articulo: 'una' },
    { nombre: 'GALLO',      articulo: 'un'  },
    { nombre: 'GATO',       articulo: 'un'  },
    { nombre: 'GORILA',     articulo: 'un'  },
    { nombre: 'GUSANO',     articulo: 'un'  },
    { nombre: 'HIPOPOTAMO', articulo: 'un'  },
    { nombre: 'HORMIGA',    articulo: 'una' }
  ];

  const RONDAS = 5;
  const RUTA_SENAS = 'recursos/senas/';
  const RUTA_ANIMALES = 'recursos/animales/';
  const CLAVE_ULTIMA = 'safari.ultimaCombinacion';

  /* Convierte "ARAÑA" -> "arana", "OSO HORMIGUERO" -> "oso-hormiguero" */
  function nombreArchivo(nombre) {
    return nombre
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

 
const VOCABULARIO = LISTA_OFICIAL.map(a => {
  const base = nombreArchivo(a.nombre);
  const nombreGif = 'sena-' + base + '.gif';

  return Object.freeze({
    nombre: a.nombre,
    articulo: a.articulo,
    soloDiccionario: !!a.soloDiccionario,
    archivo: base,
    archivoGif: nombreGif,
    rutaGif: RUTA_SENAS + nombreGif,
    rutaImagen: RUTA_ANIMALES + base + '.png'
  });
});


  /* El juego usa solo los animales; el diccionario usa todo el vocabulario */
  const ANIMALES = VOCABULARIO.filter(a => !a.soloDiccionario);

  /* ---------------------------------------------------
     2. UTILIDADES
     --------------------------------------------------- */
  const $ = id => document.getElementById(id);


  // ---------------------------------------------------
  // PRECARGA DE GIF EN SEGUNDO PLANO
  // ---------------------------------------------------
  const precargasGif = new Map();

  function precargarGif(animal) {
    if (!animal || precargasGif.has(animal.rutaGif)) return;

    const imagen = new Image();
    imagen.decoding = 'async';

    const carga = new Promise(resolve => {
      imagen.onload = () => resolve(true);
      imagen.onerror = () => {
        precargasGif.delete(animal.rutaGif);
        resolve(false);
      };
    });

    precargasGif.set(animal.rutaGif, { imagen, carga });
    imagen.src = animal.rutaGif;

    return carga;
  }

   
  /* Mezcla Fisher-Yates: todos los elementos tienen la misma probabilidad */
  function mezclar(lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  function leerUltima() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ULTIMA) || '[]');
      return Array.isArray(guardado) ? guardado : [];
    } catch (e) { return []; }
  }
  function guardarUltima(lista) {
    try { localStorage.setItem(CLAVE_ULTIMA, JSON.stringify(lista)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  /* ---------------------------------------------------
     3. ESTADO
     --------------------------------------------------- */
  const estado = {
    objetivos: [],          // 5 animales objetivo de la partida actual (en orden)
    ronda: 0,               // índice de la ronda actual (0..4)
    completadas: 0,         // rondas acertadas
    resultados: [],         // por ronda: null | 'acierto' | 'fallo' (para la hoja de papel)
    respondida: false,
    ultima: leerUltima(),   // nombres de la partida anterior, en orden
    indiceAprender: 0,
    vistos: new Set(),
    alcanzo: { aprender: true, reglas: false, juego: false }
  };

  /* ---------------------------------------------------
     4. SELECCIÓN ALEATORIA DE LOS 5 OBJETIVOS
     - 5 animales distintos (sin repetir dentro de la partida)
     - misma probabilidad para todos
     - no repite la combinación de la partida anterior (si es posible)
     --------------------------------------------------- */
  function mismaCombinacion(a, b) {
    if (a.length !== b.length || !a.length) return false;
    const x = a.slice().sort().join('|');
    const y = b.slice().sort().join('|');
    return x === y;
  }

  function generarObjetivos() {
    const hayAlternativas = ANIMALES.length > RONDAS;
    let nuevos = [];
    let intentos = 0;
    do {
      nuevos = mezclar(ANIMALES).slice(0, RONDAS);
      intentos++;
    } while (hayAlternativas && mismaCombinacion(nuevos.map(a => a.nombre), estado.ultima) && intentos < 100);
    return nuevos;
  }

  /* El distractor puede ser CUALQUIER otro animal de la lista oficial */
  function elegirDistractor(objetivo) {
    const candidatos = ANIMALES.filter(a => a !== objetivo);
    return candidatos[Math.floor(Math.random() * candidatos.length)];
  }

  /* ---------------------------------------------------
     5. NAVEGACIÓN ENTRE PANTALLAS
     --------------------------------------------------- */
  const PANTALLAS = {
    portada: 'pantallaPortada',
    inicio: 'pantallaInicio',
    aprender: 'pantallaAprender',
    reglas: 'pantallaReglas',
    juego: 'pantallaJuego',
    final: 'pantallaFinal'
  };
  const FASE_DE = { portada: null, inicio: null, aprender: 'aprender', reglas: 'reglas', juego: 'juego', final: 'juego' };
  const ORDEN_FASES = ['aprender', 'reglas', 'juego'];

  function mostrarPantalla(nombre) {
    Object.entries(PANTALLAS).forEach(([clave, id]) => {
      const sec = $(id);
      const visible = clave === nombre;
      sec.hidden = !visible;
      sec.classList.toggle('activa', visible);
    });

    if (nombre !== 'aprender') pausarVideo();
    if (nombre !== 'juego') pausarVideosJuego();

    const fase = FASE_DE[nombre];
    $('barraFases').hidden = !fase;
    document.querySelectorAll('.fase').forEach(btn => {
      const f = btn.dataset.fase;
      const esActual = f === fase;
      btn.classList.toggle('actual', esActual);
      btn.classList.toggle('hecha', !esActual && fase && ORDEN_FASES.indexOf(f) < ORDEN_FASES.indexOf(fase));
      if (esActual) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      /* Solo se puede volver a fases anteriores (Aprender / Reglas) */
      btn.disabled = f === 'juego' || esActual || (f === 'reglas' && !estado.alcanzo.reglas);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const titulo = $(PANTALLAS[nombre]).querySelector('h1, h2');
    if (titulo) titulo.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------
     6. RECURSOS PENDIENTES (imágenes y GIF)
     Los archivos se buscan siempre por su nombre. Cuando existan en la
     carpeta aparecen solos; si no, se muestra un marcador discreto.
     --------------------------------------------------- */
  function crearMarcoImagen(animal) {
    const marco = document.createElement('div');
    marco.className = 'marco-imagen';

    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;

    const pendiente = document.createElement('div');
    pendiente.className = 'pendiente';
    pendiente.hidden = true;
    pendiente.innerHTML =
      '<span class="pendiente-icono" aria-hidden="true">🐾</span>' +
      '<span class="pendiente-texto">Imagen pendiente</span>';
    const codigo = document.createElement('code');
    codigo.textContent = animal.archivo + '.png';
    pendiente.appendChild(codigo);

    img.addEventListener('load', () => { img.hidden = false; pendiente.hidden = true; });
    img.addEventListener('error', () => { img.hidden = true; pendiente.hidden = false; });
    img.src = animal.rutaImagen;

    marco.append(img, pendiente);
    return marco;
  }

  /* ---------------------------------------------------
     7. FASE 1 · APRENDIZAJE CON GIF
     --------------------------------------------------- */
  const gifSena = $('gifSena');
  const tarjetaGiro = $('tarjetaGiro');
  let girada = false;

  // Se conserva esta función porque la navegación general la utiliza.
  // Los GIF no se pueden pausar desde JavaScript como un video.
  function pausarVideo() {}

  function girarTarjeta(valor) {
    girada = typeof valor === 'boolean' ? valor : !girada;
    tarjetaGiro.classList.toggle('girada', girada);
    $('caraFrente').setAttribute('aria-hidden', girada ? 'true' : 'false');
    $('marcoVideo').setAttribute('aria-hidden', girada ? 'false' : 'true');
    $('textoGirar').textContent = girada ? 'Ver el animal' : 'Ver la seña';
  }

  gifSena.addEventListener('load', () => {
    $('pendienteVideo').hidden = true;
    gifSena.hidden = false;
  });

  gifSena.addEventListener('error', () => {
    if (!gifSena.getAttribute('src')) return;
    gifSena.hidden = true;
    $('pendienteVideo').hidden = false;
  });

  function cargarGif(animal) {
    $('pendienteVideo').hidden = true;
    gifSena.hidden = true;
    $('archivoVideo').textContent = animal.archivoGif;
    gifSena.src = animal.rutaGif;
  }

  function pintarChips() {
    const cont = $('chipsAnimales');
    cont.replaceChildren();
    VOCABULARIO.forEach((animal, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'listitem');
      b.dataset.indice = i;
      b.textContent = animal.nombre;
      b.addEventListener('click', () => mostrarAnimalAprendizaje(i));
      cont.appendChild(b);
    });
  }

  function mostrarAnimalAprendizaje(i) {
    const total = VOCABULARIO.length;
    i = Math.max(0, Math.min(total - 1, i));
    estado.indiceAprender = i;
    estado.vistos.add(i);
    const animal = VOCABULARIO[i];

    $('nombreAnimal').textContent = animal.nombre;
    $('contadorAnimal').textContent = 'Animal ' + (i + 1) + ' de ' + total;
    $('textoVistos').textContent = 'Señas vistas: ' + estado.vistos.size + ' de ' + total;
    $('barraVistos').style.width = (estado.vistos.size / total * 100) + '%';
    $('botonAnterior').disabled = i === 0;
    $('botonSiguiente').disabled = i === total - 1;

    document.querySelectorAll('.chip').forEach(chip => {
      const idx = Number(chip.dataset.indice);
      chip.classList.toggle('actual', idx === i);
      chip.classList.toggle('visto', estado.vistos.has(idx));
      if (idx === i) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
    });

    $('caraFrente').replaceChildren(crearMarcoImagen(animal));
    girarTarjeta(false);
    cargarGif(animal);
   // Adelantar la descarga de los próximos animales
   if (i + 1 < VOCABULARIO.length) {
     precargarGif(VOCABULARIO[i + 1]);
   }
   
   if (i + 2 < VOCABULARIO.length) {
     precargarGif(VOCABULARIO[i + 2]);
   }
  }

  function entrarAprendizaje() {
    mostrarPantalla('aprender');
    mostrarAnimalAprendizaje(estado.indiceAprender);
  }

  /* ---------------------------------------------------
     8. FASE 3 · EXPEDICIÓN
     --------------------------------------------------- */
  function pintarProgreso() {
    $('textoRonda').textContent = 'Ronda ' + (estado.ronda + 1) + ' de ' + RONDAS;
    const cont = $('segmentos');
    cont.replaceChildren();
    for (let i = 0; i < RONDAS; i++) {
      const s = document.createElement('div');
      s.className = 'seg' + (i < estado.completadas ? ' hecho' : (i === estado.ronda ? ' actual' : ''));
      cont.appendChild(s);
    }
  }

  function mostrarMensaje(tipo, texto) {
    const m = $('mensaje');
    m.hidden = false;
    m.className = 'mensaje ' + tipo;
    m.textContent = texto;
    m.style.animation = 'none';
    void m.offsetWidth;                 // reinicia la animación
    m.style.animation = '';
    m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function prepararRonda() {
    const objetivo = estado.objetivos[estado.ronda];
    const distractor = elegirDistractor(objetivo);
    const opciones = mezclar([objetivo, distractor]);
    estado.respondida = false;

    pintarProgreso();
    $('textoMision').innerHTML =
      '¡Explorador! Tu misión es encontrar ' + objetivo.articulo + ' <strong></strong>';
    $('textoMision').querySelector('strong').textContent = objetivo.nombre;

    $('mensaje').hidden = true;
    $('botonSiguienteRonda').hidden = true;
    if (estado.ronda > 0) window.scrollTo({ top: 0, behavior: 'smooth' });

    const cont = $('opciones');
    pausarVideosJuego();
    cont.replaceChildren();
    opciones.forEach((animal, k) => cont.appendChild(crearRama(animal, k)));
    actualizarLista();
  }

  /* ---------------------------------------------------
     Encrucijada: dos arbustos oscuros con ojos brillantes.
     Al tocar uno se abren las hojas y aparece la seña del animal.
     --------------------------------------------------- */
  function hojasSVG(semilla, cantidad) {
    let n = semilla * 9301 + 49297;
    const azar = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
    const tonos = ['#020c06', '#04140a', '#06220f', '#082a18', '#0a3018', '#0d3d1e', '#124a25'];
    let g = '';
    for (let i = 0; i < cantidad; i++) {
      const x = azar() * 200, y = azar() * 150, r = azar() * 360;
      const rx = 20 + azar() * 28, ry = 6 + azar() * 7;
      const color = tonos[Math.floor(Math.pow(azar(), 1.6) * tonos.length)];
      g += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) +
           '" transform="rotate(' + r.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="' + color + '"/>';
    }
    return '<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + g + '</svg>';
  }

  function pausarVideosJuego() {
    // Los GIF se reproducen automáticamente; no requieren play() ni pause().
  }

  function crearRama(animal, k) {
    const num = k + 1;
    const rama = document.createElement('div');
    rama.className = 'rama';
    rama.innerHTML =
      '<div class="ventana">' +
        '<div class="claro">' +
          '<img class="gif-rama" hidden loading="lazy" decoding="async" alt="Seña del animal de la opción ' + num + '">' +
          '<div class="pendiente" hidden><span class="pendiente-icono" aria-hidden="true">🐾</span>' +
          '<span class="pendiente-texto">GIF pendiente</span><code></code></div>' +
        '</div>' +
        '<button type="button" class="matorral" aria-expanded="false" aria-label="Opción ' + num + ': tocar el arbusto para ver su seña">' +
          '<span class="hojas hojas-izq">' + hojasSVG(k * 2 + 3, 46) + '</span>' +
          '<span class="hojas hojas-der">' + hojasSVG(k * 2 + 4, 46) + '</span>' +
          '<span class="ojos" aria-hidden="true"><i></i><i></i></span>' +
          '<span class="matorral-pista" aria-hidden="true">Toca para ver la seña</span>' +
        '</button>' +
      '</div>' +
      '<button type="button" class="boton boton-escoger" aria-label="Escoger la opción ' + num + '">Escoger</button>';

    const gif = rama.querySelector('.gif-rama');
    const pend = rama.querySelector('.pendiente');
     // Descargar la seña desde que se prepara la ronda
   precargarGif(animal);
    pend.querySelector('code').textContent = animal.archivoGif;

    gif.addEventListener('load', () => {
      gif.hidden = false;
      pend.hidden = true;
    });
    gif.addEventListener('error', () => {
      if (gif.getAttribute('src')) {
        gif.hidden = true;
        pend.hidden = false;
      }
    });

    rama.querySelector('.matorral').addEventListener('click', () => {
      abrirRama(rama, animal);
      rama.querySelector('.boton-escoger').focus({ preventScroll: true });
    });
    rama.querySelector('.boton-escoger').addEventListener('click', e => elegir(animal, rama, e.currentTarget));
    return rama;
  }

  function abrirRama(rama, animal) {
    if (rama.classList.contains('abierta')) return;
    rama.classList.add('abierta');
    const m = rama.querySelector('.matorral');
    m.setAttribute('aria-expanded', 'true');
    m.disabled = true;
    const gif = rama.querySelector('.gif-rama');
    gif.src = animal.rutaGif;
  }

  /* ---------------------------------------------------
     Hoja de papel con los animales de la expedición:
     acierto -> se encierra en un círculo · fallo -> se tacha
     --------------------------------------------------- */
  const SVG_CIRCULO = '<svg class="trazo circulo" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
    '<path d="M30 12 C80 2 175 6 190 28 C200 50 120 58 60 55 C15 52 2 35 12 20 C20 10 60 5 100 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  const SVG_TACHON = '<svg class="trazo tachon" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
    '<path d="M2 36 L198 20 M8 46 L190 32" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';

  function construirLista() {
    const ol = $('listaPapel');
    ol.replaceChildren();
    estado.objetivos.forEach(a => {
      const li = document.createElement('li');
      const nombre = document.createElement('span');
      nombre.className = 'nombre-papel';
      const texto = document.createElement('span');
      texto.className = 'texto-papel';
      texto.textContent = a.nombre;
      const lector = document.createElement('span');
      lector.className = 'estado-papel solo-lectores';
      nombre.appendChild(texto);
      nombre.insertAdjacentHTML('beforeend', SVG_CIRCULO + SVG_TACHON);
      nombre.appendChild(lector);
      li.appendChild(nombre);
      ol.appendChild(li);
    });
  }

  function actualizarLista() {
    document.querySelectorAll('#listaPapel li').forEach((li, i) => {
      const r = estado.resultados[i];
      li.classList.toggle('actual', i === estado.ronda && !estado.respondida);
      li.classList.toggle('acertado', r === 'acierto');
      li.classList.toggle('fallado', r === 'fallo');
      li.querySelector('.estado-papel').textContent = r === 'acierto' ? ' (acertado)' : (r === 'fallo' ? ' (fallado)' : '');
    });
  }

  function elegir(animal, rama, boton) {
    if (estado.respondida || boton.disabled) return;
    const objetivo = estado.objetivos[estado.ronda];
    abrirRama(rama, animal);              // se ve la seña del animal escogido

    if (animal === objetivo) {
      estado.respondida = true;
      estado.completadas++;
      if (estado.resultados[estado.ronda] === null) estado.resultados[estado.ronda] = 'acierto';
      rama.classList.add('correcta');
      document.querySelectorAll('#opciones .boton-escoger').forEach(t => { t.disabled = true; });
      mostrarMensaje('exito', '¡EXCELENTE! ¡HAS ENCONTRADO EL ANIMAL CORRECTO!');
      pintarProgreso();
      actualizarLista();
      lanzarConfeti(34);
      const siguiente = $('botonSiguienteRonda');
      siguiente.hidden = false;
      siguiente.innerHTML = (estado.ronda < RONDAS - 1
        ? 'Siguiente ronda <span aria-hidden="true">→</span>'
        : 'Ver mi resultado <span aria-hidden="true">🏆</span>');
      siguiente.focus({ preventScroll: true });
      siguiente.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      if (estado.resultados[estado.ronda] === null) estado.resultados[estado.ronda] = 'fallo';
      rama.classList.add('incorrecta');
      boton.disabled = true;
      actualizarLista();
      mostrarMensaje('error', '¡TE EQUIVOCASTE DE ANIMAL!');
    }
  }

  function siguienteRonda() {
    if (!estado.respondida) return;
    if (estado.ronda < RONDAS - 1) {
      estado.ronda++;
      prepararRonda();
    } else {
      mostrarFinal();
    }
  }

  function iniciarExpedicion() {
    if (ANIMALES.length < RONDAS) return;
    estado.objetivos = generarObjetivos();
    estado.ultima = estado.objetivos.map(a => a.nombre);
    guardarUltima(estado.ultima);
    estado.ronda = 0;
    estado.completadas = 0;
    estado.respondida = false;
    estado.alcanzo.juego = true;
    estado.resultados = Array(RONDAS).fill(null);
    construirLista();
    limpiarConfeti();
    prepararRonda();
    mostrarPantalla('juego');
  }

  function mostrarFinal() {
    $('textoResultado').textContent = estado.completadas + ' de ' + RONDAS + ' animales encontrados';
    const lista = $('listaEncontrados');
    lista.replaceChildren();
    estado.objetivos.forEach(a => {
      const li = document.createElement('li');
      li.textContent = a.nombre;
      lista.appendChild(li);
    });
    mostrarPantalla('final');
    lanzarConfeti(70);
  }

  /* ---------------------------------------------------
     9. CELEBRACIÓN
     --------------------------------------------------- */
  const CONFETI = ['🍃', '🌿', '⭐', '🌺', '✨', '🍀'];
  function lanzarConfeti(cantidad) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cont = $('confeti');
    for (let i = 0; i < cantidad; i++) {
      const s = document.createElement('span');
      s.textContent = CONFETI[Math.floor(Math.random() * CONFETI.length)];
      s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      s.style.setProperty('--s', (18 + Math.random() * 24).toFixed(0) + 'px');
      s.style.setProperty('--d', (2.2 + Math.random() * 2).toFixed(2) + 's');
      s.style.setProperty('--r', (Math.random() * .6).toFixed(2) + 's');
      s.style.setProperty('--g', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      cont.appendChild(s);
      setTimeout(() => s.remove(), 5200);
    }
  }
  function limpiarConfeti() { $('confeti').replaceChildren(); }

  /* ---------------------------------------------------
     10. VALIDACIÓN DE LA LISTA
     --------------------------------------------------- */
  function validarLista() {
    const aviso = $('avisoLista');
    document.querySelectorAll('[data-total-animales]').forEach(n => { n.textContent = VOCABULARIO.length; });
    if (ANIMALES.length < RONDAS) {
      aviso.hidden = false;
      aviso.textContent = 'La lista oficial tiene solo ' + ANIMALES.length + ' animales. Se necesitan al menos ' + RONDAS + ' para jugar una expedición.';
      $('botonComenzar').disabled = true;
    } else if (ANIMALES.length < RONDAS + 1) {
      aviso.hidden = false;
      aviso.textContent = 'Con ' + ANIMALES.length + ' animales no se puede garantizar una nueva combinación de cinco animales sin repetir objetivos entre partidas.';
    }
  }

  /* ---------------------------------------------------
     11. EVENTOS
     --------------------------------------------------- */
  $('botonEntrar').addEventListener('click', () => mostrarPantalla('inicio'));
  $('botonEmpezar').addEventListener('click', entrarAprendizaje);
  $('botonGirar').addEventListener('click', () => girarTarjeta());
  $('caraFrente').addEventListener('click', () => girarTarjeta(true));
  $('botonAnterior').addEventListener('click', () => mostrarAnimalAprendizaje(estado.indiceAprender - 1));
  $('botonSiguiente').addEventListener('click', () => mostrarAnimalAprendizaje(estado.indiceAprender + 1));
  $('botonIrReglas').addEventListener('click', () => { estado.alcanzo.reglas = true; mostrarPantalla('reglas'); });
  $('botonReglasAtras').addEventListener('click', entrarAprendizaje);
  $('botonComenzar').addEventListener('click', iniciarExpedicion);
  $('botonSiguienteRonda').addEventListener('click', siguienteRonda);
  $('botonSalir').addEventListener('click', entrarAprendizaje);
  $('botonNuevaExpedicion').addEventListener('click', iniciarExpedicion);
  $('botonVolverAprender').addEventListener('click', entrarAprendizaje);

  document.querySelectorAll('.fase').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.fase === 'aprender') entrarAprendizaje();
      if (btn.dataset.fase === 'reglas' && estado.alcanzo.reglas) mostrarPantalla('reglas');
    });
  });

  /* Flechas del teclado en la fase de aprendizaje */
  document.addEventListener('keydown', e => {
    if ($('pantallaAprender').hidden) return;
    if (e.key === 'ArrowRight') mostrarAnimalAprendizaje(estado.indiceAprender + 1);
    if (e.key === 'ArrowLeft') mostrarAnimalAprendizaje(estado.indiceAprender - 1);
  });

  /* ---------------------------------------------------
     12. ARRANQUE
     --------------------------------------------------- */
  validarLista();
  pintarChips();
  $('escenaFondo').innerHTML = hojasSVG(11, 150);
})();
