// Endpoint de salud para el healthcheck de Docker/orquestadores. Público y sin estado:
// no toca la base de datos ni la sesión, solo confirma que el servidor responde.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok" });
}
