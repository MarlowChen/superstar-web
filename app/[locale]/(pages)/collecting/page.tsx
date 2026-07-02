import CollectingImages from "@/app/components/CollectingImages";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

type CollectingPageProps = {
  params: { locale: string };
};

export function generateMetadata({ params }: CollectingPageProps): Metadata {
  return getPageMetadata(params.locale, 'collecting');
}

export default async function CollectingPage() {
  return <CollectingImages />;
}
