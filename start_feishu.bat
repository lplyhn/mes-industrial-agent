@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================
echo  MES Feishu Bridge 启动脚本
echo ====================================
echo.

:: 读取 .feishu.env 配置
setlocal enabledelayedexpansion
for /f "tokens=1,2 delims==" %%a in (backend\.feishu.env) do (
    if not "%%a"=="" if not "%%a"=="#*" (
        set "%%a=%%b"
    )
)

:: 检查必要服务
echo [Check] MES Gateway (:8642) ...
netstat -ano 2^>nul | findstr ":8642 " >nul
if %ERRORLEVEL% EQU 0 ( echo   [OK] Running ) else ( echo   [FAIL] Please start gateway first! & pause & exit /b )

echo.
echo [Start] Feishu Bridge on port %PORT% ...
echo.
echo   App ID: %FEISHU_APP_ID%
echo   Mode: %FEISHU_APP_ID:cli_%=custom%:app%
echo.

set "FEISHU_APP_ID=%FEISHU_APP_ID%"
set "FEISHU_APP_SECRET=%FEISHU_APP_SECRET%"
set "FEISHU_VERIFICATION_TOKEN=%FEISHU_VERIFICATION_TOKEN%"
set "PORT=%PORT%"
set "MES_GATEWAY=%MES_GATEWAY%"

python -m uvicorn backend.feishu_bridge:app --host 0.0.0.0 --port %PORT% --reload

pause
