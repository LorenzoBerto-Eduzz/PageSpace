@echo off
setlocal
title PageSpace Development
set "PAGESPACE_NODE=%~dp0local_assets\dev-runtime\node.exe"
set "PAGESPACE_DEV_CLI=%~dp0project\node_modules\electron-vite\bin\electron-vite.js"

if not exist "%PAGESPACE_NODE%" goto missing_runtime
if not exist "%PAGESPACE_DEV_CLI%" goto missing_dependencies

cd /d "%~dp0project"
"%PAGESPACE_NODE%" "%PAGESPACE_DEV_CLI%" dev
goto finished

:missing_runtime
echo.
echo The PageSpace development runtime is missing.
goto failed

:missing_dependencies
echo.
echo The PageSpace development dependencies are missing.
goto failed

:failed
echo Ask Codex to repair the PageSpace development setup.
pause

:finished
endlocal
