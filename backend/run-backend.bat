@echo off
echo ========================================
echo    AI Smart Autofill Backend v1.1.0
echo ========================================
echo.
echo Starting server on http://localhost:8000
echo Health check: http://localhost:8000/health
echo API docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
python -m uvicorn app.main:app --reload --port 8000

pause




