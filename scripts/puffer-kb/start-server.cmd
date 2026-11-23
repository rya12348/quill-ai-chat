@echo off
title Puffer Party - pack + AI server
cd /d "%~dp0"
echo.
echo  Puffer Party pack + AI server
echo  ------------------------------
echo  Serving on http://127.0.0.1:5201
echo.
echo  KEEP THIS WINDOW OPEN while you play.
echo  The bot answers from its offline pack on its own, but any category the
echo  pack does not know is looked up live: Wikipedia list articles, Datamuse,
echo  and the AI lanes. Closing this window turns all of that off.
echo.
node serve.mjs 5201
echo.
echo  Server stopped. Press any key to close.
pause >nul
