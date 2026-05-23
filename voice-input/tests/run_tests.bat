@echo off
chcp 65001 >nul
:: ===========================================
:: 语音输入法 - 一键测试运行脚本 (Windows)
:: 用法: tests\run_tests.bat
:: ===========================================

setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0..
set REPORT_DIR=%PROJECT_DIR%\tests\reports
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=!TIMESTAMP: =0!
set REPORT_FILE=%REPORT_DIR%\test-report-!TIMESTAMP!.txt

echo ============================================
echo   语音输入法 - 自动化测试套件
echo ============================================
echo.
echo 项目目录: %PROJECT_DIR%
echo 测试报告: %REPORT_FILE%
echo.

if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

:: Check node_modules
if not exist "%PROJECT_DIR%\node_modules" (
    echo [安装依赖] node_modules 不存在，执行 npm install...
    cd /d "%PROJECT_DIR%"
    call npm install --include=dev
    if !ERRORLEVEL! neq 0 (
        echo [错误] npm install 失败
        exit /b 1
    )
    echo [完成] 依赖安装完成
    echo.
)

echo ============================================
echo   开始执行测试...
echo ============================================
echo.

cd /d "%PROJECT_DIR%"

:: Run tests
call npx jest --config tests/jest.config.ts --verbose --no-cache > "%REPORT_FILE%" 2>&1
set EXIT_CODE=%ERRORLEVEL%

type "%REPORT_FILE%"

echo.
echo ============================================
echo   测试摘要
echo ============================================

:: Find test counts
findstr /C:"Tests:" "%REPORT_FILE%" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    for /f "tokens=*" %%a in ('findstr "Tests:" "%REPORT_FILE%"') do echo %%a
)

:: Check for failures
if %EXIT_CODE% equ 0 (
    echo.
    echo ============================================
    echo   ✅ 所有测试通过!
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   ❌ 部分测试失败 (exit code: %EXIT_CODE%)
    echo ============================================
)

echo.
echo 详细报告: %REPORT_FILE%
echo.

exit /b %EXIT_CODE%
