# Notas incorrectas en Paraphonic: sincronización de la frecuencia de audio

El dueño reportó en A/B/C el mismo problema de notas en modo parafónico que el
investigado para Prophet V3. Se consultó la implementación y documentación local
de `experiments/prophet-pad-v3` y `paraphonic-pitch-investigation` como referencia.
No se modificaron esos proyectos ni los firmwares previos de Six-Op.

## Defecto reproducido en la UIFix anterior

Six-Op obtenía sample_rate, one_hz y a0 desde el global nativo 0x20000004 sólo al
cargar el patch. Un setter nativo de frecuencia de audio posterior deja obsoletos
los tres valores por voz. La prueba ejecuta las funciones ARM exactas del MFF
anterior, constructores y teclas nativos: configura 48 kHz, inicializa, pasa de
mono a cuatro voces, sostiene un acorde y luego llama al setter real a 32 kHz.

En A, B y C las cuatro voces conservan una relación a0_cache/a0_actual de 2/3.
Al resetear sólo dos objetos reales se obtienen dos voces con relación 1 y otras
dos con 2/3. Es un mecanismo capaz de producir notas dependientes del historial.
`dist/live-rate-before.json` guarda los valores y la identidad del binario.

Es una secuencia forzada de ciclo de vida. No reproduce el arranque físico ni
confirma por sí sola que el dispositivo haga esa secuencia al activar Paraphonic.

## Corrección

Antes de cada render, el adaptador consulta el global nativo y llama SetSampleRate.
Si no cambió, no escribe estado ni recalcula envolventes. Si cambió, actualiza
sample_rate/one_hz/a0 y reescala los incrementos de las seis envolventes de operador
y la de pitch. Conserva fases, amplitudes, feedback, gate, niveles, etapa, fase
interna y punto de partida de cada envolvente. No usa Init/Reset/Setup para
retimar, por lo que no añade retrigger ni el bloque silencioso de cambio de patch.

No añade campos: objeto host 24, arena 792 y Voice<6> 500 bytes. Sample rates
admitidos 8–192 kHz. La inicialización sin configuración válida usa 48 kHz;
actualizaciones inválidas se ignoran. No promete ausencia de aliasing a altas notas.
Los bancos, controles, SF6 V6 y la corrección de pantalla de UIFix se conservan.

## Pruebas

- 141 casos nativos entre los tres bancos: configuración tardía con acorde
  sostenido, historial 60/61/62/67/72/48/60/84/60 en 48/32/96/16/48 kHz y vuelta
  desde stock. Se comprueban las cuatro instancias del núcleo, sus períodos
  vigentes y las notas recibidas del asignador nativo, con tolerancia de 0,05
  semitonos al pequeño ajuste nativo de pitch.
- Offsets de diagnóstico calculados por el compilador ARM para los mismos
  headers; no se inventan direcciones de estado. Se usan los helpers stock ya
  mapeados: setter 0x0802FF0C y global 0x20000004.
- Un wrapper ARM sólo de prueba llama al mismo SetSampleRate en voces activas.
  Sólo pueden variar los tres campos de timing y coeficientes de envolvente.
  El resto de los 500 bytes permanece idéntico. Se comprueba el factor de escala,
  no-op a igual frecuencia y rechazo de valores inválidos.
- Regresión de los 96 patches contra Voice original a frecuencia fija, cuatro
  voces, nombres/controles, presets, cambio entre bancos, UIFix, motores retenidos,
  Ghidra/refscan, reconstrucción y checksums de la entrega.

Los informes se vinculan al SHA del payload; el empaquetador exige las pruebas
específicas y la regresión completa. La salida física y relojes son fixtures;
no se simulan ciclos reales de CPU, interrupciones o arranque físico. El firmware
corregido requiere prueba en el equipo. No se accedió a hardware ni se flasheó.
