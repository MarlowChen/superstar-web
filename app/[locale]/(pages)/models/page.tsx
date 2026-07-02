"use server";

import { redirect } from "next/navigation";

export default async function ModelsPage({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/drawing`);
}
