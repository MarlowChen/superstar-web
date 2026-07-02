
export const metadata = {
  title: "登入 | 超星AI平台",
  description: "登入超星AI平台，開始使用 AI 生成與創作功能。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  return children;
}
