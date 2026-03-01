@echo off
setlocal enableextensions

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to enter project root: "%ROOT_DIR%"
  exit /b 1
)

echo [INFO] Project root: %CD%

if not exist "node_modules" (
  echo [INFO] node_modules not found, installing dependencies...
  call npm.cmd ci
  if errorlevel 1 (
    echo [ERROR] npm ci failed.
    popd >nul
    exit /b 1
  )
)

set "ELECTRON_BUILDER_CACHE=%CD%\.cache\electron-builder"
set "NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

echo [INFO] Building production installers...
call npm.cmd run dist:desktop
if errorlevel 1 (
  echo [ERROR] Build failed.
  popd >nul
  exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./apps/desktop/package.json').version"`) do set "APP_VERSION=%%v"
if not defined APP_VERSION (
  echo [ERROR] Failed to detect app version from apps/desktop/package.json
  popd >nul
  exit /b 1
)

set "SETUP_EXE=%CD%\apps\desktop\release\AinoldMarkdown Setup %APP_VERSION%.exe"
set "PORTABLE_EXE=%CD%\apps\desktop\release\AinoldMarkdown %APP_VERSION%.exe"

if not exist "%SETUP_EXE%" (
  echo [ERROR] Missing setup package: "%SETUP_EXE%"
  popd >nul
  exit /b 1
)

if not exist "%PORTABLE_EXE%" (
  echo [ERROR] Missing portable package: "%PORTABLE_EXE%"
  popd >nul
  exit /b 1
)

echo [SUCCESS] Production packages generated:
echo   - %SETUP_EXE%
echo   - %PORTABLE_EXE%

popd >nul
exit /b 0
