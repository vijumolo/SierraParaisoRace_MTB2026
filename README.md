# Sierra Paraiso Race MTB 2026

Aplicacion web responsiva para consultar los resultados oficiales del evento `SIERRA PARAISO RACE` en la modalidad `MTB`, usando como fuente real los PDF oficiales de resultados y diplomas.

## Que hace

- Lee los datos reales desde `public/data/sierra-paraiso-race-mtb.json`.
- Permite filtrar por nombre, placa, categoria, genero y ciudad.
- Muestra los resultados registro por registro.
- Abre un visor individual para el diploma exacto de cada deportista.
- Incluye opcion de impresion directa del diploma.

## Desarrollo

```bash
npm install
npm run dev
```

## Produccion

```bash
npm run build
npm run preview
```

## Fuente de datos

- `public/pdfs/resultados-por-categorias-mtb.pdf`
- `public/pdfs/diplomas-mtb.pdf`

El dataset fue generado desde esos PDF con:

```bash
node scripts/extract-sierra-paraiso-data.mjs
```
