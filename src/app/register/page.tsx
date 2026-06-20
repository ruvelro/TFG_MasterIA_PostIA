import Link from "next/link";

import { RegisterForm } from "./register-form";

// Página de registro (pública). El registro es abierto: cualquiera puede crear una cuenta.
export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-primary text-sm font-semibold">
          ← PostIA
        </Link>
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <p className="text-muted text-sm">Regístrate para empezar a generar artículos.</p>
      </div>

      <RegisterForm />

      <p className="text-muted text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary font-medium">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
