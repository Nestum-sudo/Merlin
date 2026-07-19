import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettingsData } from "@/lib/settings-data";
import SettingsView from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.userId) {
    redirect("/onboarding");
  }

  const data = await getSettingsData(session.userId);
  return <SettingsView data={data} />;
}
