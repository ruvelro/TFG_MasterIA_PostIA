/**
 * Lista de bloqueo de contraseñas notoriamente comunes (en minúsculas).
 *
 * Es deliberadamente pequeña y local: no sustituye a un servicio como HaveIBeenPwned,
 * pero ataja las contraseñas más triviales sin depender de la red, lo que mantiene la
 * validación determinista y testeable. La política de complejidad (ver password.ts) ya
 * descarta la mayoría; esto cubre casos que pasarían la complejidad pero son obvios.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "p@ssword1",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "111111",
  "iloveyou",
  "admin",
  "admin123",
  "welcome",
  "welcome1",
  "abc123",
  "letmein",
  "monkey",
  "dragon",
  "football",
  "1q2w3e4r",
  "qwertyuiop",
  "changeme",
  "secret",
  "contraseña",
  "contrasena",
  // Variantes "complejas" muy comunes que SÍ pasarían la política de complejidad: este es
  // el valor real de la lista de bloqueo, ya que la complejidad por sí sola las aceptaría.
  "password123!",
  "password1!",
  "passw0rd123!",
  "p@ssw0rd123",
  "qwerty123!",
  "welcome123!",
  "iloveyou123!",
]);
