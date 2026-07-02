import { redirect } from "next/navigation";

type AieroneAliasPageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

function buildQueryString(searchParams: AieroneAliasPageProps["searchParams"]) {
  const params = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry != null) params.append(key, entry);
      });
      return;
    }

    if (value != null) params.set(key, value);
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function AieroneAliasPage({
  params,
  searchParams,
}: AieroneAliasPageProps) {
  redirect(`/${params.locale}/drawing${buildQueryString(searchParams)}`);
}
