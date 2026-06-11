@echo off
rem ------------------------------------------------------------
rem Run FastAPI backend and open the web UI
rem ------------------------------------------------------------

set "PROJECT_ROOT=%~dp0"

rem Start the backend in a new terminal window
start "FastAPI" cmd /k "cd /d %PROJECT_ROOT%backend && uvicorn app.main:app --reload"

rem Wait a few seconds for the server to start
timeout /t 5 > nul

rem Open the UI in the default browser
start "" "http://127.0.0.1:8000/"
