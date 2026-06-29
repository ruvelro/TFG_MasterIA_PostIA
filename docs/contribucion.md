# Guía de contribución

## Flujo de ramas

```
main ──────●────────────────────────●───────►   (estable, solo releases)
            \                       /
develop ─────●────●────●────●──────●─────────►   (integración)
              \        \
               feature/x feature/y               (trabajo del día a día)
```

- **`main`**: siempre desplegable. Solo recibe merges desde `develop` vía PR de release.
- **`develop`**: rama de integración. Las features se mergean aquí mediante PR.
- **`feature/*`, `fix/*`, `chore/*`, `docs/*`**: una rama por unidad de trabajo.

## Convenciones de commit

Se usan [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: añade la etapa de research al pipeline
fix: corrige el filtrado de artículos por usuario
docs: documenta el modelo de datos
test: añade tests del resolver de modelos
chore: configura husky y lint-staged
```

## Antes de abrir un PR

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`

Los hooks de Git ejecutan parte de esto automáticamente (`pre-commit`: lint-staged;
`pre-push`: typecheck + tests), pero conviene comprobarlo antes de pedir revisión.

## Integración continua (CI)

Cada push y cada PR a `develop` o `main` dispara el workflow de **GitHub Actions**
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)), que replica el gate del hook
`pre-push` en el servidor (no es saltable): **lint → typecheck → test → build** y, en un job
aparte, los **e2e de Playwright**. Los e2e usan dependencias falsas (`E2E=true`), así que no
necesitan claves reales de OpenRouter ni de búsqueda.

## Revisión

Cada PR pasa por revisión de código. En las ramas que tocan autenticación o el pipeline
de IA se ejecuta además una revisión de seguridad (`/security-review`).
