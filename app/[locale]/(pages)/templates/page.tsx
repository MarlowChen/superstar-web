import { Metadata } from "next";
import TemplatesPage from "@/app/components/TemplatesPage";
import { getPageMetadata } from "@/app/lib/metadata";

type TemplatesPageProps = {
  params: { locale: string };
};

export function generateMetadata({ params }: TemplatesPageProps): Metadata {
  return getPageMetadata(params.locale, "templates");
}

export default function TemplatesRoutePage({ params }: TemplatesPageProps) {
  return <TemplatesPage locale={params.locale} />;
}
