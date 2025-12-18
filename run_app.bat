@echo off
echo Starting Pustaka+...

:: Start Backend
start "Pustaka+ - Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

:: Start Frontend
start "Pustaka+ - Frontend" cmd /k "cd frontend && npm run dev"

echo Application started! 
echo check the two new terminal windows.
pause
