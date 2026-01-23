# Trade Republic PDF Extractor & Portfolio Analyzer

Una herramienta moderna, segura y de código abierto para extraer, analizar y visualizar tus transacciones de Trade Republic directamente desde los extractos oficiales en PDF.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Dashboard+Preview)

## ✨ Características Principales

*   **Privacidad Total:** Todo el procesamiento se realiza localmente en tu navegador. Tus datos financieros nunca salen de tu ordenador.
*   **Análisis de Portfolio (FIFO):** Cálculo automático de ganancias y pérdidas históricas utilizando el método FIFO (First-In, First-Out).
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

Para facilitar el uso, hemos incluido scripts automáticos que inician un servidor local seguro y abren la aplicación en tu navegador.

#### En Windows 🪟
1.  Busca el archivo `run.bat` en la carpeta del proyecto.
2.  Haz doble clic sobre él.
3.  Se abrirá una ventana de consola mostrando el estado del servidor y automáticamente se lanzará tu navegador en modo incógnito en `http://localhost:9000`.
4.  Para cerrar la aplicación, simplemente vuelve a la ventana de la consola y pulsa cualquier tecla.

#### En macOS / Linux 🍎🐧
1.  Abre tu terminal y navega hasta la carpeta del proyecto.
2.  Ejecuta el script con el comando:
    ```bash
    ./run.sh
    ```
    *(Si tienes problemas de permisos, ejecuta primero `chmod +x run.sh`)*
3.  El servidor se iniciará y abrirá tu navegador predeterminado (Chrome, Firefox, etc.) en modo privado.
4.  Para salir, pulsa cualquier tecla en la terminal y el servidor se detendrá.

### Paso 3: Cargar y Analizar

1.  Una vez abierta la aplicación en el navegador, arrastra y suelta tu archivo PDF en el área designada o haz clic para seleccionarlo.
2.  Espera unos segundos mientras la herramienta procesa el documento.
3.  ¡Listo! Navega por las pestañas para ver tus transacciones, gráficos y reportes fiscales.

---

## 📊 Funcionalidades Detalladas

### 1. Transacciones de Efectivo
Una tabla limpia y ordenada con todas tus operaciones monetarias.
*   **Filtros inteligentes:** Solo muestra transacciones relevantes con fecha confirmada.
*   **Columnas clave:** Fecha, Tipo, Nombre del Activo, Cantidad, Entrada y Salida de dinero.
*   **Exportación:** Descarga el historial completo en `extracto.json`.

### 2. Dashboard de Portfolio (Gráficos)
Visualiza el rendimiento de tus inversiones de un vistazo.
*   **KPIs:** Ganancia Histórica, Pérdida Histórica, Beneficio Neto y Promedio Mensual.
*   **Rendimiento Mensual:** Gráfico de barras con el resultado neto de cada mes. Pasa el ratón para ver el desglose de ganancias y pérdidas.
*   **Distribución de Beneficios:** Gráfico circular que destaca los activos que más rentabilidad te han dado.

### 3. Trading P&L (Reporte Fiscal)
Una herramienta potente para calcular tus obligaciones fiscales.
*   **Posiciones Activas:** Muestra qué activos tienes actualmente en cartera y su precio promedio de compra.
*   **Histórico FIFO:** Tabla detallada de todas las operaciones cerradas, calculando la ganancia o pérdida exacta según el método FIFO.
    *   🟢 **Verde:** Operaciones con ganancia.
    *   🔴 **Rojo:** Operaciones con pérdida.
*   **Descargas:**
    *   `operaciones_realizadas_fifo.json`: Reporte de compra-venta.
    *   `ingresos_dividendos_intereses.json`: Reporte separado de dividendos e intereses recibidos.

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

*   Siempre verifica los resultados con tus propios registros.
*   El cálculo FIFO es una estimación basada en los datos extraídos del PDF y puede no cubrir casos complejos (splits, fusiones, transferencias de cartera externas).
*   Utiliza estos datos bajo tu propia responsabilidad para tus declaraciones fiscales.

---

*Desarrollado con pasión para la comunidad inversora.*
