# Reglas de Firestore: propuesta más estricta

**Estado: borrador sin publicar ni probar.** Las reglas vigentes son las de `firestore.rules`
(sin cambios). La propuesta está en `docs/firestore.rules.propuesta`.

## Qué permite hoy y qué permitiría la propuesta

| Acción | Reglas actuales | Propuesta |
|---|---|---|
| Leer una sala por su código | Cualquier usuario con sesión | Igual |
| Listar todas las salas | Cualquier usuario con sesión | Nadie |
| Crear una sala | Cualquiera, siendo el anfitrión | Igual, y solo consigo mismo como jugador |
| Unirse a una sala | Cualquiera puede reescribir la sala entera | Solo añadirse a sí mismo, si está en espera y hay sitio |
| Modificar o borrar una sala | Cualquier usuario con sesión | Solo sus jugadores |
| Leer o escribir manos | Cualquier usuario con sesión | Solo los jugadores de esa sala |

## Lo que la propuesta NO resuelve

Las reglas del juego se ejecutan en el navegador de cada jugador. Por eso, **dentro de una
sala**, un jugador con conocimientos técnicos todavía podría leer la mano de otro o escribir
un estado inválido. Evitarlo exigiría mover la lógica a un servidor (Cloud Functions), que es
un cambio grande. Para partidas entre amigos o en el aula, la propuesta cierra lo importante:
nadie de fuera puede espiar, alterar ni borrar salas ajenas.

## Requisito: el campo `playerUids`

Las reglas de Firestore no pueden buscar un uid dentro de `players` (es una lista de objetos),
así que la propuesta usa una lista paralela de uid: `playerUids`.

Desde la v2.2 el juego ya la escribe al crear una sala, al unirse y al salir
(`js/firebase.js`). Con las reglas actuales ese campo no afecta en nada.

**Las salas creadas antes de la v2.2 no tienen `playerUids`** y dejarían de funcionar con la
propuesta. Antes de publicar, deja que terminen o bórralas desde la consola de Firebase.

## Cómo probarla antes de publicar

1. **Simulador de reglas** (consola de Firebase → Firestore → Reglas → *Simulador de reglas*):
   pega la propuesta sin publicarla y simula, con un uid de prueba:
   - `get` de `/rooms/ABCD` con sesión → permitido; sin sesión → denegado.
   - `update` de una sala donde el uid **no** está en `playerUids` → denegado.
   - `get` de `/rooms/ABCD/hands/OTRO_UID` siendo jugador → permitido; sin serlo → denegado.
2. **Partida real con dos cuentas**, mejor en un proyecto de Firebase de pruebas o con el
   emulador local (`firebase emulators:start --only firestore`):
   - Crear sala, unirse con la segunda cuenta, empezar.
   - Jugar al menos una carta que toque la mano del otro (Ensayo Sorpresa, Cambio de Notas,
     Partitura, Rotación de Orquesta).
   - Salir de la sala con ambos (el último la borra).
   - Intentar unirse a una sala llena y a una ya empezada (debe rechazarlo).

## Cómo publicarla (cuando esté probada)

1. Copia el contenido de `docs/firestore.rules.propuesta` a `firestore.rules`.
2. Publica desde la consola de Firebase (Firestore → Reglas → Publicar) o con:

```bash
firebase deploy --only firestore:rules
```

3. Si algo falla, vuelve a la versión anterior desde el historial de reglas de la consola.
