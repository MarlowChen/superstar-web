import { getTheme } from "../../actions/theme";
import { CustomToast } from "../../components/CustomToast";
import RootLayoutClient from "../../components/RootLayoutClient";

export const generateStaticParams = () => ["zh", "en"].map((lng) => ({ lng }));

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const storedTheme = await getTheme();

  return (
    <>
      <RootLayoutClient
        initialUser={null}
        initialTheme={storedTheme ?? "dark"}
      >
        {children}
      </RootLayoutClient>
      <CustomToast />
    </>
  );
}
