import type { Metadata } from "next";
import TemplateDetailPage from "@/app/components/TemplatesPage/TemplateDetailPage";

type TemplateDetailRouteProps = {
  params: {
    locale: string;
    slug: string;
  };
};

export function generateMetadata({ params }: TemplateDetailRouteProps): Metadata {
  return {
    title: `${params.slug} | 超星AI平台`,
  };
}

export default function TemplateDetailRoute({ params }: TemplateDetailRouteProps) {
  return <TemplateDetailPage locale={params.locale} slug={params.slug} />;
}
