import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading mt-3 text-5xl">Page not found</h1>
      <p className="mt-3 text-sm text-stone">The page you&apos;re looking for has moved or no longer exists.</p>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
