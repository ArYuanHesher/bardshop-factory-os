 'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QaHandlePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/qa/handling');
  }, [router]);
  return (
    <div className="p-6 max-w-[900px] mx-auto text-center text-white">
      <h1 className="text-2xl font-bold mb-4">異常單處理頁面已移至品保專區</h1>
      <p>請前往 <a href="/qa/handling" className="text-cyan-400 underline">品保專區異常單處理</a>。</p>
    </div>
  );
}
