import OnboardingView from "@/components/onboarding/OnboardingView";

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: { step?: string; userId?: string; strava?: string };
}) {
  const initialStep = searchParams.step === "garmin" ? "garmin" : "account";
  const initialUserId = searchParams.userId ?? null;
  const stravaCancelled = searchParams.strava === "cancelled";

  return <OnboardingView initialStep={initialStep} initialUserId={initialUserId} stravaCancelled={stravaCancelled} />;
}
