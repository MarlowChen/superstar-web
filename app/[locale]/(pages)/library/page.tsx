import PublishedImages from "@/app/components/PublishedImages";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

type LibraryPageProps = {
  params: { locale: string };
};

export function generateMetadata({ params }: LibraryPageProps): Metadata {
  return getPageMetadata(params.locale, 'library');
}

export default async function LibraryPage() {
  // if (!connectionToken) {
  //   redirect("../")
  //   // return <div>Loading...</div>;
  // }
  
  return <PublishedImages />;
}
