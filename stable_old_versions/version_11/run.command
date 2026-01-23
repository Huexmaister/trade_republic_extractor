#!/bin/bash

# ============================================================================
#  Script para iniciar el entorno de desarrollo en macOS (Doble Click)
# ============================================================================

# Asegurar que estamos en el directorio del script
cd "$(dirname "$0")"

# --- Configuracion ---
PORT=9000

echo ""
echo " ================================================"
echo "     Levantando el Servidor de TradeRepublic"
echo " ================================================"
echo ""

# 1. Verificar si Python esta instalado
PYTHON_CMD=python3
if ! command -v $PYTHON_CMD &> /dev/null; then
    PYTHON_CMD=python
    if ! command -v $PYTHON_CMD &> /dev/null; then
        echo " [ERROR] No se ha encontrado Python."
        echo "         Por favor, instala Python 3 para continuar."
        exit 1
    fi
fi
echo " - Python detectado."

# 2. Iniciar el servidor HTTP en segundo plano (Logs ocultos)
echo " - Iniciando servidor en http://localhost:$PORT"
$PYTHON_CMD -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# Esperar un momento para que el servidor este listo
sleep 2

# 3. Abrir el navegador en modo privado/incognito
echo " - Abriendo el navegador en modo privado..."

# Detectar SO y abrir el navegador correspondiente
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Para macOS (puedes descomentar tu navegador preferido)
    open -a "Google Chrome" --args --incognito "http://localhost:$PORT"
    # open -a "Firefox" --args -private-window "http://localhost:$PORT"
    # open -a "Safari" "http://localhost:$PORT" # Safari no tiene flag para modo privado
else
    # Fallback si se ejecuta en otro entorno
    echo "   No se pudo detectar macOS. Intentando abrir navegador genérico..."
    open "http://localhost:$PORT"
fi

echo ""
echo " ================================================"
echo ""
echo " El servidor esta activo y listo."
echo ""
read -n 1 -s -r -p " Pulsa cualquier tecla para detener el servidor."
echo ""
echo ""

# 4. Detener el servidor
echo " - Deteniendo el servidor (PID: $SERVER_PID)..."
kill $SERVER_PID

echo ""
echo " ================================================"
echo "  Servidor detenido. ¡Hasta pronto!"
echo " ================================================"
echo ""
