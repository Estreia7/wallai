import Image from "next/image";

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  year: number | null;
  category: string;
  link: string | null;
};

export function BookCard({ book }: { book: Book }) {
  const content = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors sm:hover:border-white/20 sm:hover:bg-white/[0.06] sm:flex-row sm:gap-4">
      <div className="relative mx-auto aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:mx-0 sm:w-20">
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt={`${book.title} cover`}
            fill
            sizes="(max-width: 640px) 96px, 80px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/50">
            No cover
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
            {book.category}
          </span>
          {book.year && <span className="text-[10px] text-white/50">{book.year}</span>}
        </div>
        <h3 className="text-sm font-semibold text-white sm:text-base">{book.title}</h3>
        <p className="text-[11px] text-white/50">by {book.author}</p>
        {book.description && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/60 sm:line-clamp-4">
            {book.description}
          </p>
        )}
      </div>
    </div>
  );

  if (!book.link) return content;
  return (
    <a
      href={book.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      {content}
    </a>
  );
}
