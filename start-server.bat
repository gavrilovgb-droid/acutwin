@echo off
powershell -Command "Start-Process -NoNewWindow -FilePath node -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -RedirectStandardOutput '%~dp0server.log' -RedirectStandardError '%~dp0server.err'"
timeout /t 2 /nobreak >nul
start http://localhost:5500
echo Server started: http://localhost:5500
