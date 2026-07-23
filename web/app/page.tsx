import { redirect } from "next/navigation";

/** Ruta raíz (`/`): redirige siempre al portal de empleados (`/portal`). No hay landing propia. */
export default function Home() {
  redirect("/portal");
}
