# Corrección de fidelidad y diagnóstico pendiente

## Hallazgo comprobado

La simplificación usaba `Pow2Fast(-14+level)`. El original, a profundidad LFO
cero, usa `Pow2Fast(-14+level*(1-Pow2Fast(-6.4)))`.
El factor está dentro del exponente; afecta los seis operadores, incluidos los
moduladores y el operador realimentado. No cambia los bytes del banco ni sus
algoritmos/feedback. La corrección añade12bytes de código y ninguna RAM.

El campo `Parameters.amp_mod` del port contiene el desplazamiento del control
Release. La corrección NO lo conecta como un LFO a la fórmula original: mantiene
la curva original a LFO cero, y Release continúa afectando sólo tiempos.
No se restaura el LFO DX7 ni la segunda voz interna.

## Diagnóstico de la diferencia adicional en hardware

`sixop-fidelity-study/render_arm.py` ejecutó144000muestras de la imagen ARM
LiveRate real. Frente al render nativo del mismo DSP, el error máximo fue
5,1546e-8 y el RMS de la nota sostenida coincidió. No se reprodujo un cambio
significativo de timbre causado por la compilación ARM.

`probe_host.py` ejecutó constructores, teclado lógico, parámetros y coordinador
nativos con SOLID BASS mono. Capturó nota47,987999 (offset nativo ya conocido),
Brightness/Envelope0,5, accent0,8, sample_rate48000 y bloque16. La salida PCM del
host interpola esos16valores a32palabras. No se debe escuchar el buffer bruto a
48000Hz e inferir afinación física: la frecuencia DAC real no se midió.
No se distribuye ese PCM como una grabación de hardware.

En600bloques: pico PCM6723/32767, cero muestras recortadas. Al ajustar una ganancia
lineal y contemplar la interpolación stock, error máximo cercano a1,26unidades
PCM y error RMS relativo0,0123%. Este resultado sólo describe esa prueba mono.
No demuestra ausencia de clipping en otros patches, acordes o presets.

Esto descarta una discrepancia grande en el núcleo ARM y en ese recorrido digital
controlado. No identifica aún la causa de todo el carácter robótico percibido en
el instrumento. No corresponde atribuirlo al filtro analógico ni al firmware sin
una comparación física con ajustes conocidos.

## Evidencia acústica previa

A igual volumen, en SOLID BASS MIDI48, la distancia entre espectros medios del
port bloque16 y editor bajó de2,060a0,621dB con la ley restaurada, manteniendo
softclip. Quitar softclip por sí solo dejaba1,843dB. Al igualar también el bloque
a128 y usar salida lineal, la distancia fue0,069dB. Son métricas de señal para
un caso, no una puntuación de calidad ni prueba de identidad entre plataformas.

## Antes de dar por resuelto el reporte físico

Comparar A01 en mono con controles y macros50/50, sin matriz ni efectos,
filtro abierto y resonancia cero. Verificar que el firmware instalado sea la
versión comparada. Grabar una nota directa sin saturar la entrada de audio y
compararla con el render ARM de esta versión a volumen igualado. Si persiste la
diferencia, registrar preset, modo y nota para reproducirla. La corrección de
amplitud está validada; esa comprobación física sigue pendiente.
