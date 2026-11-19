# Cuerpo humano del mapa de inyección (MakeHuman, CC0)

`public/models/makehuman-body.bin` sale de la malla base y los *targets* de
[MakeHuman](https://github.com/makehumancommunity/makehuman), commit
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Los activos de MakeHuman son **CC0 1.0** (`LICENSE.ASSETS.md`
del repositorio): no piden pago ni atribución. El código de MakeHuman (AGPL) no se usa ni se ejecuta.

## Qué contiene

- El cuerpo femenino joven (mezcla igual de las tres etnias de MakeHuman, proporciones ideales al 50 %).
- La diferencia hombre menos mujer y las diferencias de peso mínimo y máximo de cada sexo.
- Los 4 puntos de cada sitio de inyección como índices de vértice, iguales para cualquier mezcla.

El cliente mezcla el cuerpo con el sexo y el IMC registrados del paciente (`src/ui/body/bodyAsset.ts`).

## Regenerar

1. Descarga, en una carpeta propia, estos archivos del commit indicado:
   - `makehuman/data/3dobjs/base.obj`
   - `makehuman/data/targets/macrodetails/{african,asian,caucasian}-{female,male}-young.target`
   - `makehuman/data/targets/macrodetails/universal-{female,male}-young-averagemuscle-{maxweight,minweight}.target`
   - `makehuman/data/targets/macrodetails/proportions/{female,male}-young-averagemuscle-averageweight-idealproportions.target`
2. Ejecuta:

   ```bash
   python3 -P scripts/makehuman/build_body.py --data <carpeta> --out public/models/makehuman-body.bin
   ```

`src/ui/body/bodyAsset.test.ts` comprueba el archivo: marco de 4 unidades, lados, caras y simetría de
los puntos.
