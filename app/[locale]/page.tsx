import { cookies } from "next/headers";

import LandingHome from "@/app/components/Homepage/LandingHome";
import { getPageMetadata } from "@/app/lib/metadata";

type HomePageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: HomePageProps) {
  return getPageMetadata(params.locale, "home");
}

export default async function Page({ params }: HomePageProps) {
  const locale = params.locale;
  const cookieStore = cookies();
  const hasAuthCookie = Boolean(
    cookieStore.get("payload-token")?.value || cookieStore.get("auth-token")?.value
  );

  return (
    <LandingHome
      locale={locale}
      initialUser={hasAuthCookie ? undefined : null}
      hasAuthCookie={hasAuthCookie}
    />
  );
}
