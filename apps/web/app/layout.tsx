export const metadata = {
  title: "Merlin",
  description: "O teu treino, num só sítio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
