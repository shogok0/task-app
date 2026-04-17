export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-8 pt-safe pb-safe">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
