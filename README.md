# Trade Republic PDF Extractor & Portfolio Analyzer

Una herramienta moderna, segura y de código abierto para extraer, analizar y visualizar tus transacciones de Trade Republic directamente desde los extractos oficiales en PDF.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Dashboard+Preview)

## ✨ Características Principales

*   **Privacidad Total:** Todo el procesamiento se realiza localmente en tu navegador. Tus datos financieros nunca salen de tu ordenador.
*   **Análisis de Portfolio (FIFO):** Cálculo automático de ganancias y pérdidas históricas utilizando el método FIFO (First-In, First-Out).
*   **Edición y Recálculo:** Posibilidad de corregir fechas de transacciones manualmente y recalcular todo el reporte al instante.
*   **Dashboard Interactivo:** Visualiza tu rendimiento mensual, distribución de beneficios por activo y métricas clave (Ganancia Total, Pérdida Total, Neto).
*   **Exportación Flexible:** Descarga tus datos en formatos JSON, CSV o Excel para usarlos en otras herramientas o para tu declaración de impuestos.
*   **Soporte Multi-idioma:** Detecta y procesa extractos en español, inglés, alemán e italiano.

---

## 🚀 Cómo Empezar

### Paso 1: Obtener tu Extracto de Cuenta (PDF)

Para usar esta herramienta, necesitas el extracto de cuenta oficial (Account Statement) que proporciona Trade Republic. Sigue estos pasos para obtenerlo:

1.  Abre la aplicación de **Trade Republic** en tu móvil.
2.  Ve a tu **Perfil** (icono de persona en la esquina superior izquierda).
3.  Desplázate hacia abajo hasta la sección **Actividad** o **Documentos**.
4.  Busca **"Extracto de Cuenta"** (Account Statement) o "Saldo de Cuenta".
5.  Selecciona el rango de fechas que desees (se recomienda descargar el historial completo para un cálculo FIFO preciso).
6.  Pulsa en **Descargar** o **Compartir**.
7.  Envía el archivo PDF a tu correo electrónico (Gmail, Outlook, etc.) o guárdalo en tu nube (Google Drive, iCloud) para acceder a él desde tu ordenador.

### Paso 2: Ejecutar la Aplicación

Para facilitar el uso, hemos incluido scripts automáticos que inician un servidor local seguro y abren la aplicación en tu navegador. Los logs del servidor se han ocultado para mantener la consola limpia.

#### En Windows 🪟
1.  Busca el archivo `run.bat` en la carpeta del proyecto.
2.  Haz doble clic sobre él.
3.  Se abrirá una ventana de consola (sin logs molestos) y automáticamente se lanzará tu navegador en modo incógnito en `http://localhost:9000`.
4.  Para cerrar la aplicación, simplemente vuelve a la ventana de la consola y pulsa cualquier tecla.

#### En macOS 🍎
1.  Busca el archivo `run.command` en la carpeta del proyecto.
2.  Haz doble clic sobre él.
3.  Se abrirá una terminal y lanzará tu navegador predeterminado en modo incógnito.
4.  Para salir, pulsa cualquier tecla en la terminal.

#### En Linux 🐧
1.  Abre tu terminal y navega hasta la carpeta del proyecto.
2.  Ejecuta el script con el comando:
    ```bash
    ./run.sh
    ```
    *(Si tienes problemas de permisos, ejecuta primero `chmod +x run.sh`)*
3.  El servidor se iniciará y abrirá tu navegador.

### Paso 3: Cargar y Analizar

1.  Una vez abierta la aplicación en el navegador, arrastra y suelta tu archivo PDF en el área designada o haz clic para seleccionarlo.
2.  Espera unos segundos mientras la herramienta procesa el documento.
3.  ¡Listo! Navega por las pestañas para ver tus transacciones, gráficos y reportes fiscales.

---

## 📊 Funcionalidades Detalladas

La aplicación organiza la información en varias pestañas para facilitar su análisis:

### 1. Transacciones de Efectivo
Esta es la vista principal de tus movimientos bancarios.
*   **Qué ves:** Una tabla detallada con cada movimiento de dinero (entradas y salidas).
*   **Columnas:** Fecha, Tipo de operación, Descripción/Nombre, Cantidad, Dinero que entra (Incoming) y Dinero que sale (Outgoing).
*   **Edición:** Puedes modificar manualmente la fecha (`date_iso`) si detectas discrepancias con la fecha real de la operación.
*   **Botones de Acción:**
    *   **Guardar y Recalcular:** Si has editado alguna fecha, pulsa este botón para regenerar todos los cálculos (FIFO, impuestos, gráficos) con la nueva información.
    *   **CSV / Excel:** Descarga la tabla tal cual la ves para abrirla en Excel o Google Sheets.
    *   **Exportar Extracto (JSON):** Genera un archivo `extracto.json` con todos los datos crudos procesados del PDF. Ideal para copias de seguridad o análisis programático.

### 2. Gráficos
Un dashboard visual para entender tu rendimiento global.
*   **Qué ves:**
    *   **KPIs:** Tarjetas con tu Ganancia Total, Pérdida Total, Beneficio Neto y Promedio Mensual.
    *   **Rendimiento Mensual:** Un gráfico de barras que muestra cuánto ganaste o perdiste mes a mes.
    *   **Distribución de Beneficios:** Un gráfico circular (Donut) que te dice qué activos (acciones/ETFs) han contribuido más a tus ganancias.

### 3. Fondos Monetarios
Una sección dedicada a los movimientos de liquidez.
*   **Qué ves:** Transacciones relacionadas con intereses generados por el efectivo no invertido o fondos del mercado monetario.

### 4. Trading P&L (Beta)
La herramienta más potente para el cálculo fiscal y análisis de rentabilidad.
*   **Nota Importante:** Esta sección está en Beta. Los cálculos se realizan mediante ingeniería inversa de los extractos (Neto -> Bruto) asumiendo las tasas impositivas estándar.
*   **Limitaciones:** No se tienen en cuenta criptomonedas ni derivados liquidados (estos últimos pueden figurar como posición abierta).
*   **Qué ves:**
    *   **Posiciones Activas:** Una tabla con las acciones que aún tienes en cartera, calculando su coste medio de adquisición y cantidad total.
    *   **Ganancias y Pérdidas Históricas (FIFO):** Una tabla con cada venta realizada, desglosando:
        *   *Venta Neta:* Lo que recibiste en el banco.
        *   *Coste Base:* Cuánto te costaron esas acciones originalmente (según FIFO).
        *   *Resultado:* Tu ganancia o pérdida real antes de impuestos.
*   **Botones de Descarga:**
    *   **Descargar FIFO (JSON):** Genera el archivo `operaciones_realizadas_fifo.json`. Contiene el detalle de cada venta, incluyendo el **% de ganancia neta** por operación, impuestos estimados y comisiones.
    *   **Descargar Ingresos (JSON):** Genera el archivo `ingresos_dividendos_intereses.json`. Agrupa tus ingresos pasivos por año y mes, categorizados claramente en **"Dividendos"**, **"Interés"** y **"Saveback"**.

### 5. Desglose de Ventas
Una vista detallada y amigable de cada operación de venta realizada.
*   **Qué ves:** Un listado de acordeones desplegables para cada venta.
*   **Resumen:** De un vistazo ves el activo, la fecha y el beneficio neto (en verde o rojo).
*   **Detalle:** Al desplegar, accedes a toda la información de la operación:
    *   **Operación de Venta:** Cantidad, precio de venta, importe bruto y neto.
    *   **Resultado:** Desglose de beneficio bruto, comisiones, impuestos y beneficio neto final.
    *   **Lotes de Compra (FIFO):** Una tabla que muestra exactamente qué compras anteriores se utilizaron para calcular el coste de esta venta (fecha, cantidad y precio de compra de cada lote).

### 6. Resumen de Resultados
Una vista final de auditoría.
*   **Qué ves:** Un resumen del número total de transacciones procesadas y alertas sobre posibles inconsistencias en los saldos (si las hubiera).

---

## 🛠️ Tecnologías Utilizadas

*   **PDF.js:** Para la lectura y extracción de texto de los archivos PDF.
*   **Chart.js:** Para la generación de gráficos interactivos y visualmente atractivos.
*   **Tailwind CSS:** Para un diseño moderno, limpio y responsivo.
*   **JavaScript (ES6+):** Lógica de procesamiento de datos y cálculo financiero.

---

## ❤️ Agradecimientos y Créditos

Este proyecto se ha construido sobre la base de la comunidad de código abierto. Un agradecimiento especial a:

*   **[jcmpagel](https://github.com/jcmpagel/Trade-Republic-CSV-Excel)**: Por su excelente trabajo pionero en la lógica de extracción de datos de Trade Republic, que ha servido de inspiración y base para partes del parser de esta herramienta.

---

## ⚠️ Aviso Legal

Esta herramienta se proporciona "tal cual" y es de código abierto. Aunque nos esforzamos por garantizar la precisión de los cálculos, **no somos asesores financieros ni fiscales**.

*   **Margen de Error:** Los cálculos de Trading P&L se basan en la ingeniería inversa de los extractos y pueden tener un margen de error debido a redondeos o comisiones complejas.
*   **Impuestos:** Se presupone que el cálculo de impuestos realizado por la App de Trade Republic es correcto. Si el extracto original contiene errores, esta herramienta los reflejará.
*   **Verificación:** Siempre verifica los resultados con tus propios registros y documentos oficiales antes de presentar cualquier declaración fiscal.

---

*Desarrollado con pasión para la comunidad inversora.*
