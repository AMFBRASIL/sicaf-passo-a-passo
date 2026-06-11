export const metadata = {
  title: "CADBRASIL API",
  description: "Backend da plataforma CADBRASIL v2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
