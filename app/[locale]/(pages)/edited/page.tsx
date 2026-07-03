import EditedImages from "@/app/components/EditedImages";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

type EditedPageProps = {
  params: { locale: string };
};

export function generateMetadata({ params }: EditedPageProps): Metadata {
  return getPageMetadata(params.locale, 'edited');
}

export default async function EditedPage() {
  return <EditedImages />;
}
