@echo off
echo Building React application...
call npm run build

echo.
echo Installing serve package...
call npm install -g serve

echo.
echo Starting server on port 3000...
echo Access from other devices using your laptop IP address
echo Example: http://192.168.1.10:3000
echo.
serve -s build -l 3000
