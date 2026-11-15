# Reglas de Firestore

**Estado: desplegadas el 2026-11-15** en el proyecto `juego-de-cartas-musicala`. El archivo
vigente es `firestore.rules`. La versión anterior (abierta a cualquier usuario con sesión)
está guardada en `docs/firestore.rules.anterior`.

Se desplegaron sin una prueba con dos cuentas reales: conviene hacer la partida de prueba de
la sección "Cómo probarlas" cuanto antes.

## Qué permitían antes y qué permiten ahora

| Acción | Reglas anteriores | Reglas vigentes |
|---|---|---|
| Leer una sala por su código | Cualquier usuario con sesión | Igual |
| Listar todas las salas | Cualquier usuario con sesión | Nadie |
| Crear una sala | Cualquiera, siendo el anfitrión | Igual, y solo consigo mismo como jugador |
| Unirse a una sala | Cualquiera puede reescribir la sala entera | Solo añadirse a sí mismo, si está en espera y hay sitio |
| Modificar o borrar una sala | Cualquier usuario con sesión | Solo sus jugadores |
| Leer o escribir manos | Cualquier usuario con sesión | Solo los jugadores de esa sala |

## Lo que estas reglas NO resuelven

Las reglas del juego se ejecutan en el navegador de cada jugador. Por eso, **dentro de una
sala**, un jugador con conocimientos técnicos todavía podría leer la mano de otro o escribir
un estado inválido. Evitarlo exigiría mover la lógica a un servidor (Cloud Functions), que es
un cambio grande. Para partidas entre amigos o en el aula, estas reglas cierran lo importante:
nadie de fuera puede espiar, alterar ni borrar salas ajenas.

## Requisito: el campo `playerUids`

Las reglas de Firestore no pueden buscar un uid dentro de `players` (es una lista de objetos),
así que se usa una lista paralela de uid: `playerUids`.

El juego la escribe al crear una sala, al unirse y al salir (`js/firebase.js`).

**Las salas creadas antes del 2026-11-15 no tienen `playerUids`** y ya no funcionan: hay que
crear una sala nueva.

## Cómo probarlas

1. **Simulador de reglas** (consola de Firebase → Firestore → Reglas): simula un `update`
   de una sala con un uid que no está en `playerUids` (debe denegarse).
2. **Partida real con dos cuentas** en el juego publicado:
   - Crear sala, unirse con la segunda cuenta, empezar.
   - Jugar al menos una carta que toque la mano del otro (Ensayo Sorpresa, Cambio de Notas,
     Partitura, Rotación de Orquesta).
   - Salir de la sala con ambos (el último la borra).
   - Intentar unirse a una sala llena y a una ya empezada (debe rechazarlo).

## Cómo volver a las reglas anteriores

Si el modo en línea falla, restaura la versión anterior desde el historial de la consola de
Firebase (Firestore → Reglas), o copia `docs/firestore.rules.anterior` sobre `firestore.rules`
y despliega:

```bash
firebase deploy --only firestore:rules --project juego-de-cartas-musicala
```
