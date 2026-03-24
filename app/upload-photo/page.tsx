'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

function UploadPhotoContent() {
  const searchParams = useSearchParams()
  const sid = searchParams.get('sid') || ''
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [error, setError] = useState('')

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const loadExisting = useCallback(async () => {
    if (!sid) return
    const { data } = await supabase.storage
      .from('anomaly-attachments')
      .list(`mobile/${sid}`)
    if (data && data.length > 0) {
      const urls = data.map((f) => {
        const { data: urlData } = supabase.storage
          .from('anomaly-attachments')
          .getPublicUrl(`mobile/${sid}/${f.name}`)
        return urlData.publicUrl
      })
      setUploaded(urls)
    }
  }, [sid])

  useEffect(() => {
    void loadExisting()
  }, [loadExisting])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !sid) return

    setUploading(true)
    setError('')

    try {
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const filePath = `mobile/${sid}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('anomaly-attachments')
          .upload(filePath, file)

        if (uploadError) {
          setError(`上傳失敗：${uploadError.message}`)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('anomaly-attachments')
          .getPublicUrl(filePath)
        if (urlData?.publicUrl) {
          setUploaded((prev) => [...prev, urlData.publicUrl])
        }
      }
    } catch {
      setError('上傳發生錯誤')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!sid) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-slate-400">
          <p className="text-xl mb-2">無效的上傳連結</p>
          <p className="text-sm">請從電腦端掃描 QR Code 開啟</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center pt-4">
          <h1 className="text-xl font-bold text-white">📷 手機拍照上傳</h1>
          <p className="text-sm text-slate-400 mt-1">拍照後圖片會自動同步到電腦表單</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-cyan-700 rounded-xl p-6 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="text-4xl">📸</span>
            <span className="text-cyan-300 font-bold">
              {uploading ? '上傳中...' : '拍照'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-violet-700 rounded-xl p-6 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="text-4xl">🖼️</span>
            <span className="text-violet-300 font-bold">
              {uploading ? '上傳中...' : '相簿'}
            </span>
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => void handleUpload(e)}
          disabled={uploading}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void handleUpload(e)}
          disabled={uploading}
          className="hidden"
        />

        {error && (
          <div className="bg-rose-900/30 border border-rose-700 rounded-lg p-3 text-rose-300 text-sm text-center">
            {error}
          </div>
        )}

        {uploaded.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">已上傳 {uploaded.length} 張圖片</p>
            <div className="grid grid-cols-3 gap-2">
              {uploaded.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`已上傳 ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border border-slate-700"
                />
              ))}
            </div>
            <p className="text-xs text-emerald-400 text-center mt-2">✅ 圖片已同步，可返回電腦繼續操作</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadPhotoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">載入中...</div>}>
      <UploadPhotoContent />
    </Suspense>
  )
}
