import ModelsRedirect from "@/app/components/ModelsRedirect";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

type ModelsPageProps = {
  params: { locale: string };
};

export function generateMetadata({ params }: ModelsPageProps): Metadata {
  return getPageMetadata(params.locale, "models");
}

export default function ModelsPage({ params }: ModelsPageProps) {
  return <ModelsRedirect locale={params.locale} />;
}
