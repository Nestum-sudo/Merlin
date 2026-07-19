import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import OnboardingView from "@/components/onboarding/OnboardingView";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { strava?: string };
}) {
  const session = await auth();
  const stravaCancelled = searchParams.strava === "cancelled";

  if (!session?.userId) {
    // ainda sem sessão — mostra só o botão "Continuar com Strava"
    return <OnboardingView step="account" stravaCancelled={stravaCancelled} />;
  }

  const [user] = await query<{ garmin_onboarding_skipped: boolean }>(
    `SELECT garmin_onboarding_skipped FROM users WHERE id = $1`,
    [session.userId]
  );
  const [garminAccount] = await query<{ status: string }>(
    `SELECT status FROM connected_accounts WHERE user_id = $1 AND provider = 'garmin'`,
    [session.userId]
  );

  // já tem sessão E (Garmin ligado OU já escolheu saltar antes) — não faz
  // sentido voltar a mostrar o onboarding a cada login
  if (garminAccount?.status === "connected" || user?.garmin_onboarding_skipped) {
    redirect("/");
  }

  return <OnboardingView step="garmin" stravaCancelled={false} />;
}
