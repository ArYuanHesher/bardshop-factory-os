'use client'

import { useCallback, useEffect, useState } from 'react'

export interface InventorySyncResult {
  syncedCount: number
  skippedCount: number
  table: string
}

interface InventorySyncConfig {
  table: string
  customColumn: string
  sequenceNoField: string
  itemCodeField: string
  itemNameField: string
  specField: string
  physicalCountField: string
  bookCountField: string
  warehouseTotalField: string
  groupByItemCode: boolean
}

interface InventorySyncPanelProps {
  title?: string
  description?: string
  className?: string
  initialConfig?: Partial<InventorySyncConfig>
  onSynced?: (result: InventorySyncResult) => Promise<void> | void
}

const STORAGE_KEY = 'argoerp_inventory_sync_config_v1'

const DEFAULT_CONFIG: InventorySyncConfig = {
  table: '',
  customColumn: '',
  sequenceNoField: 'SEQ',
  itemCodeField: 'ITEM_CODE',
  itemNameField: 'ITEM_NAME',
  specField: 'SPEC',
  physicalCountField: 'PHYSICAL_COUNT',
  bookCountField: 'BOOK_COUNT',
  warehouseTotalField: 'QISHENG_SICHUAN_TOTAL',
  groupByItemCode: false,
}

export default function InventorySyncPanel({
  title = 'ARGO 庫存同步',
  description = '會把 ARGO 查詢結果覆寫到本地 material_inventory_list，供 BOM / 替代料與物料頁面共用。',
  className = '',
  initialConfig,
  onSynced,
}: InventorySyncPanelProps) {
  const [config, setConfig] = useState<InventorySyncConfig>(DEFAULT_CONFIG)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        // 無本地設定時，以 initialConfig 預填
        const seed: InventorySyncConfig = { ...DEFAULT_CONFIG, ...(initialConfig ?? {}) }
        setConfig(seed)
        setShowSettings(!seed.table.trim())
        return
      }

      const parsed = JSON.parse(raw) as Partial<InventorySyncConfig>
      const nextConfig = {
        ...DEFAULT_CONFIG,
        ...(initialConfig ?? {}),
        ...parsed,
      }
      setConfig(nextConfig)
      if (!nextConfig.table.trim()) setShowSettings(true)
    } catch {
      const seed: InventorySyncConfig = { ...DEFAULT_CONFIG, ...(initialConfig ?? {}) }
      setConfig(seed)
      setShowSettings(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {}
  }, [config])

  const updateConfig = useCallback((key: keyof InventorySyncConfig, value: string) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const handleSync = useCallback(async () => {
    if (!config.table.trim()) {
      setMessage('❌ 請先填入 ARGO 庫存查詢 TABLE。')
      setShowSettings(true)
      return
    }

    if (!config.itemCodeField.trim() || !config.bookCountField.trim()) {
      setMessage('❌ 至少要設定料號欄位與帳上庫存欄位。')
      setShowSettings(true)
      return
    }

    setSyncing(true)
    setMessage('')

    try {
      const response = await fetch('/api/argoerp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_inventory',
          table: config.table.trim(),
          customColumn: config.customColumn.trim() || undefined,
          mapping: {
            sequenceNoField: config.sequenceNoField.trim() || undefined,
            itemCodeField: config.itemCodeField.trim(),
            itemNameField: config.itemNameField.trim() || undefined,
            specField: config.specField.trim() || undefined,
            physicalCountField: config.physicalCountField.trim() || undefined,
            bookCountField: config.bookCountField.trim(),
            warehouseTotalField: config.warehouseTotalField.trim() || undefined,
            groupByItemCode: config.groupByItemCode,
          },
        }),
      })

      const result = (await response.json()) as {
        status: 'ok' | 'error'
        error?: string
        syncedCount?: number
        skippedCount?: number
        table?: string
      }

      if (!response.ok || result.status !== 'ok' || !result.syncedCount || !result.table) {
        throw new Error(result.error || 'ARGO 庫存同步失敗')
      }

      setMessage(`✅ 已同步 ${result.syncedCount} 筆庫存資料（來源：${result.table}）`)

      if (onSynced) {
        await onSynced({
          syncedCount: result.syncedCount,
          skippedCount: result.skippedCount ?? 0,
          table: result.table,
        })
      }
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'ARGO 庫存同步失敗'}`)
    } finally {
      setSyncing(false)
    }
  }, [config, onSynced])

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/50 ${className}`.trim()}>
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {showSettings ? '收合同步設定' : '展開同步設定'}
          </button>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {syncing ? '同步中...' : '同步 ARGO 庫存'}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="grid grid-cols-1 gap-3 border-t border-slate-800 px-4 py-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">TABLE</label>
            <input
              value={config.table}
              onChange={(event) => updateConfig('table', event.target.value)}
              placeholder="例如 MM_ITEM_STOCK"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">CUSTOMCOLUMN</label>
            <input
              value={config.customColumn}
              onChange={(event) => updateConfig('customColumn', event.target.value)}
              placeholder="例如 ITEM_CODE,ITEM_NAME,SPEC,BOOK_COUNT"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">序號欄位</label>
            <input
              value={config.sequenceNoField}
              onChange={(event) => updateConfig('sequenceNoField', event.target.value)}
              placeholder="可留白"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">料號欄位</label>
            <input
              value={config.itemCodeField}
              onChange={(event) => updateConfig('itemCodeField', event.target.value)}
              placeholder="ITEM_CODE"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">品名欄位</label>
            <input
              value={config.itemNameField}
              onChange={(event) => updateConfig('itemNameField', event.target.value)}
              placeholder="ITEM_NAME"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">規格欄位</label>
            <input
              value={config.specField}
              onChange={(event) => updateConfig('specField', event.target.value)}
              placeholder="SPEC"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">盤點數量欄位</label>
            <input
              value={config.physicalCountField}
              onChange={(event) => updateConfig('physicalCountField', event.target.value)}
              placeholder="PHYSICAL_COUNT"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">帳上庫存欄位</label>
            <input
              value={config.bookCountField}
              onChange={(event) => updateConfig('bookCountField', event.target.value)}
              placeholder="BOOK_COUNT"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">四川總倉欄位</label>
            <input
              value={config.warehouseTotalField}
              onChange={(event) => updateConfig('warehouseTotalField', event.target.value)}
              placeholder="QISHENG_SICHUAN_TOTAL"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3 flex items-start gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={config.groupByItemCode}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, groupByItemCode: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-600 accent-cyan-500"
              />
              <span className="text-xs text-slate-300">
                合併相同料號數量（iv_inventoryboh 明細表用）
              </span>
            </label>
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="text-xs leading-relaxed text-slate-500">
              這組設定會共用在目前頁面與物料管理頁面。若 ARGO 查詢欄位名稱不同，只要改這裡一次即可。
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className={`border-t border-slate-800 px-4 py-3 text-sm ${message.startsWith('❌') ? 'text-red-300' : 'text-emerald-300'}`}>
          {message}
        </div>
      )}
    </div>
  )
}