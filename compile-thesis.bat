@echo off
setlocal

set TEX=docs\mainraw.tex
set OUTDIR=docs
set OUTPDF=docs\mainraw.pdf
set COPYPDF=docs\mainraw_preview.pdf

echo Compiling %TEX% with tectonic...
tectonic -c --outdir %OUTDIR% %TEX%

if errorlevel 1 (
    echo Compilation failed. Check docs\mainraw.log for details.
    exit /b 1
)

echo Copying to %COPYPDF%...
copy /Y %OUTPDF% %COPYPDF% >nul

echo Done. Preview: %COPYPDF%
endlocal
