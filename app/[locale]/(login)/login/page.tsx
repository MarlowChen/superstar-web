import Login from "@/app/components/Login";
import { AuthProvider } from "@/app/context/AuthContext";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";


type LoginPageProps = {
  params: { locale: string };
  searchParams?: {
    callbackUrl?: string;
  };
};


export function generateMetadata({ params }: LoginPageProps): Metadata {
  return getPageMetadata(params.locale, 'login');
}

export default async function LoginPage() {
  return (
    <div className=" overflow-auto w-full h-full">
      <AuthProvider initialUser={null}>
        <Login />
      </AuthProvider>
    </div>
  );
}
