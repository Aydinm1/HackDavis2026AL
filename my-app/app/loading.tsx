export default function Loading() {
  return (
    <main className="min-h-screen bg-[#101010] px-5 py-8 pb-28 font-sans text-[#F5F5F5]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center gap-5">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="h-10 w-64 rounded-full bg-white/10" />
        <div className="space-y-3">
          <div className="h-24 rounded-2xl bg-white/5" />
          <div className="h-24 rounded-2xl bg-white/5" />
          <div className="h-24 rounded-2xl bg-white/5" />
        </div>
      </div>
    </main>
  );
}
