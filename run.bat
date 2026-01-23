@echo off
setlocal

:: ============================================================================
::  Script para iniciar el entorno de desarrollo en Windows
:: ============================================================================

:: --- Configuracion ---
set PORT=9000
:: Puedes cambiar "msedge" por "chrome", "firefox", etc.
set BROWSER=msedge

echo.
echo  ================================================
echo      Levantando el Servidor de TradeRepublic
echo  ================================================
echo.

:: 1. Verificar si Python esta instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo          Por favor, instala Python para continuar.
    pause
    exit /b
)
echo  - Python detectado.

:: 2. Iniciar el servidor HTTP (Logs ocultos)
echo  - Iniciando servidor en http://localhost:%PORT%
start "Python HTTP Server" /B cmd /c "python -m http.server %PORT% >nul 2>&1"

:: Esperar un momento para que el servidor este listo
timeout /t 2 /nobreak > nul

:: 3. Abrir el navegador en modo incognito
echo  - Abriendo el navegador (%BROWSER%) en modo incognito...
start "" "%BROWSER%" --inprivate "http://localhost:%PORT%"

echo.
echo  ================================================
echo.
echo  El servidor esta activo y listo.
echo.
echo  Pulsa cualquier tecla para detener el servidor.
echo.
pause > nul

:: 4. Detener el servidor
echo.
echo  - Buscando y deteniendo el proceso del servidor en el puerto %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a > nul
    echo  - Proceso con PID %%a detenido.
)

echo.
echo  ================================================
echo  Servidor detenido. ¡Hasta pronto!
echo  ================================================
echo.

endlocal
