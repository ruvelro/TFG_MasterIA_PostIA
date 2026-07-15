# Guion del vídeo de presentación — PostIA

> Guion para el **vídeo explicativo del TFM** (requisito 5). Duración objetivo: **6–8 min**.
> Es obligatorio **capturar la pantalla** mientras explicas; mostrar tu cara con webcam es
> opcional. Graba en horizontal a 1080p. Antes de grabar, ten el contenedor levantado
> (`docker compose up -d`, en `http://localhost:38291`) con las claves de OpenRouter y de
> búsqueda ya configuradas, y un usuario admin creado.
>
> Consejo: ensaya una vez con el cronómetro. No leas palabra por palabra; usa los puntos
> como apoyo. Las **slides** (`docs/presentacion-postia.pptx`) pueden servirte de hilo
> conductor para las partes 1 y 6.

---

## Checklist previo a grabar

- [ ] Contenedor arriba y `http://localhost:38291` abierto en el navegador.
- [ ] Sesión iniciada con un usuario **admin** (claves de API ya configuradas).
- [ ] Un artículo ya generado en el historial (para no depender de la generación en vivo).
- [ ] Editor de código abierto en el proyecto (para la parte técnica).
- [ ] Notificaciones del sistema silenciadas; pestañas personales cerradas.
- [ ] Micrófono probado; resolución de pantalla a 1080p y zoom del navegador al 100–110 %.

---

## Parte 1 — Introducción (0:00 – 0:45)

**En pantalla:** slide de portada (o la landing del proyecto).

**Qué decir:**

- "Hola, soy [tu nombre]. Os presento **PostIA**, mi Trabajo de Fin de Máster."
- "Es una aplicación web que convierte **un tema** en un **artículo de blog publicable**."
- "La diferencia con un generador normal es que **no hace una sola llamada a un modelo**:
  usa un **pipeline de 12 etapas**, parte de **fuentes reales** descargadas de la web, y cuida
  que el texto suene humano, esté optimizado para SEO/GEO y pueda incluir una imagen destacada."
- "Pero, sobre todo, está construido cuidando las **buenas prácticas de ingeniería**, que es
  el criterio de evaluación: arquitectura, seguridad, tests y documentación."

---

## Parte 2 — El problema y la idea (0:45 – 1:30)

**En pantalla:** slide "La IA de un solo paso no basta" + slide del pipeline de 12 etapas.

**Qué decir:**

- "El contenido generado de un solo paso tiene tres problemas: **alucina datos**, tiene
  **‘sabor a IA’** y **no está optimizado**."
- "La idea de PostIA es **descomponer** la generación en etapas especializadas." (Señala el
  diagrama de 12 etapas.)
- "Se agrupan en cuatro fases: **investigar** con fuentes reales, **redactar**, **validar**
  en un bucle con jueces especializados, y **pulir, enriquecer e ilustrar**."
- "Y cada etapa de IA puede usar **un modelo distinto**, según lo que cueste y exija."

---

## Parte 3 — Demo: generar un artículo (1:30 – 4:00) ⭐ _la parte más importante_

**En pantalla:** la app real. Ve narrando lo que haces.

1. **Formulario de generación** (`/generate`).
   - "Escribo un **tema**. Puedo añadir contexto, elegir el **tipo de noticia** y la
     **longitud**, indicar el **idioma**, y dejar activada la **revisión de los hechos** o de la
     estructura."
   - "Si el tema se parece a artículos previos, PostIA me avisa con embeddings para evitar
     duplicados."
   - (Opcional) Abre "Avanzado": "Aquí podría sobrescribir el **modelo o el prompt** de una
     etapa concreta solo para esta generación."
   - Pulsa **Generar**.

2. **Progreso en vivo.**
   - "Veo cada etapa ejecutándose en **tiempo real**, con su estado y el **modelo** que usa.
     Esto va por _streaming_."

3. **Pausa de revisión humana.**
   - "El pipeline **se pausa**: ha investigado y extraído los hechos **agrupados por fuente**,
     y son fuentes **reales** —aquí se ven los dominios—. Puedo editarlos, quitarlos o
     añadir alguno antes de que redacte." Pulsa **Continuar y redactar**.

4. **Resultado** (puedes saltar a un artículo ya generado del historial para no esperar).
   - "Este es el artículo final, en Markdown. Arriba tiene su **meta description**, **slug** y
     **keywords**."
   - "Y estas **métricas de calidad** las calcula el propio sistema: **anclaje factual**,
     nivel de **riesgo**, el porcentaje de **‘sabor a IA’**… y el **coste** de la generación."
   - "Más abajo trae el **enriquecimiento**: titulares alternativos, **etiquetas**, una **FAQ**,
     el texto **alt** de la imagen, el **Schema.org** y el prompt para la imagen destacada."
   - "Desde aquí puedo **exportar Markdown/HTML**, publicar en **WordPress** si está configurado,
     o lanzar una **revisión dirigida** sin repetir la investigación."

**Consejo:** si la generación en vivo tarda, di "mientras termina, os enseño uno ya hecho" y
abre el del **Historial**. Queda natural y evita silencios largos.

---

## Parte 4 — Panel de administración (4:00 – 5:00)

**En pantalla:** `/admin`.

- **Claves API:** "Las claves de OpenRouter y del buscador se guardan **cifradas** en la base
  de datos; aquí solo se ven **enmascaradas**."
- **Pipeline:** "Lo más interesante: puedo configurar el **modelo y el prompt de cada etapa**
  sin tocar código."
- **Tipos de noticia / Longitudes / Estilo:** "Defino qué etapas se activan por tipo, los
  presets de longitud, la frescura de las fuentes, estilos de imagen y la **voz editorial**."
- **Coste / Errores:** "Y tengo **observabilidad**: el coste por ejecución, presupuesto diario por
  usuario y un registro de errores."

---

## Parte 5 — Cuenta y seguridad (5:00 – 5:30)

**En pantalla:** `/account`.

- "El registro es abierto y exige **contraseñas fuertes**. Además puedo registrar una
  **passkey** (WebAuthn) para entrar **sin contraseña**, resistente a phishing."
- "También puedo crear **claves de API personales**, revocables, para usar PostIA desde otros
  sistemas."

---

## Parte 6 — Cómo está hecho: buenas prácticas (5:30 – 7:00) ⭐ _clave para el tribunal_

**En pantalla:** el editor de código + `docs/`. Muestra, sin entrar en detalle, archivos reales.

- **Arquitectura por capas.** "El dominio vive en `src/lib`, **sin depender de React ni Next**.
  Eso lo hace **testeable** de forma aislada." (Abre `src/lib/pipeline/`.)
- "El orquestador recibe sus dependencias **inyectadas**, así puedo testearlo **sin red ni
  claves**."
- **Tipado y validación.** "Todo está en **TypeScript estricto** y validado con **Zod**, tanto
  la entrada del usuario como las **salidas de la IA**."
- **Seguridad por diseño.** (Abre `docs/seguridad.md`.) "Secretos cifrados con AES-256-GCM,
  autorización por roles, cabeceras de seguridad, _rate limiting_, saneado del Markdown…"
- **Pruebas + CI.** (Ejecuta `npm run test` o muestra GitHub Actions.) "**158 tests** entre
  unitarios e integración, más **e2e** con Playwright. Y un _workflow_ de **CI** que corre
  lint, typecheck, tests y build en cada Pull Request."
- **Documentación y decisiones.** (Abre `docs/` y `docs/decisiones/`.) "Hay documentación
  completa y **ADRs** que registran el porqué de cada decisión."

---

## Parte 7 — Cierre (7:00 – 7:30)

**En pantalla:** slide final / repositorio.

- "En resumen: PostIA demuestra que **descomponer la generación** y anclarla en fuentes reales
  produce artículos **mejores y gobernables**, con un código que cuida las **buenas prácticas**."
- "El **código**, la **documentación** y esta **presentación** están en el repositorio.
  Muchas gracias."

---

## Notas finales

- **Duración:** si te pasas de 8 min, recorta la parte 4 (admin) y la 6 (técnica), no la 3 (demo).
- **Errores en directo:** si algo falla en la generación en vivo, no pasa nada: ten siempre un
  artículo del historial como plan B.
- Sube el vídeo a **YouTube (no listado)** o **Google Drive** con acceso público y añade la
  **URL** en el README y en el formulario de entrega.
