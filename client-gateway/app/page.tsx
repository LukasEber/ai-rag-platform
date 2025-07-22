import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Welcome to the AI RAG Platform</h1>
      <div className="flex flex-col sm:flex-row gap-8">
        <Link href="/project">
          <Button asChild size="lg" className="px-12 py-8 text-xl shadow-lg rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition">
            <span>Manage Projects</span>
          </Button>
        </Link>
        <Link href="/chat">
          <Button asChild size="lg" className="px-12 py-8 text-xl shadow-lg rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/90 transition">
            <span>Chat</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
