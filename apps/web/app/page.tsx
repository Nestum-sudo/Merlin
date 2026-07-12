import { redirect } from "next/navigation";

// Ponto de entrada — decide onboarding vs dashboard consoante o estado da
// sessão. Por agora, redireciona sempre para o onboarding.
export default function Home() {
  redirect("/onboarding");
}
