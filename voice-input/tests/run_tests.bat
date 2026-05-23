@echo off
chcp 65001 >nul
:: ===========================================
:: 语音输入法 - 一键测试运行脚本 (Windows)
:: 用法: tests\run_tests.bat
:: ===========================================

setlocal enabledelayedexpansion

:: 计算项目根目录（批处理文件所在目录的上一级）
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%i in ("%SCRIPT_DIR%") do set "PROJECT_DIR=%%~dpi"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "REPORT_DIR=%PROJECT_DIR%\tests\reports"

set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=!TIMESTAMP: =0!"
set "REPORT_FILE=%REPORT_DIR%\test-report-!TIMESTAMP!.txt"

echo ============================================
echo   语音输入法 - 自动化测试套件
echo ============================================
echo.
echo 项目目录: %PROJECT_DIR%
echo 测试报告: %REPORT_FILE%
echo.

if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

cd /d "%PROJECT_DIR%"

:: Run tests
echo ============================================
echo   开始执行测试...
echo ============================================
echo.

call npx jest --config tests/jest.config.js --verbose --no-cache > "%REPORT_FILE%" 2>&1
set EXIT_CODE=%ERRORLEVEL%

type "%REPORT_FILE%"

echo.
echo ============================================
echo   测试摘要
echo ============================================

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
