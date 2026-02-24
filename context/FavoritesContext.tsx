'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface FavoritesContextType {
  favorites: string[]
  toggleFavorite: (path: string) => void
  loading: boolean
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id || ''

      // 1. 🔥 從瀏覽器取出登入者的 Email
      // (這個值是在 Login 頁面登入成功時存進去的)
      const currentUserEmail = localStorage.getItem('bardshop_user_email')

      if (!currentUserEmail && !authUserId) {
        console.warn('尚未登入，無法讀取個人設定')
        setLoading(false)
        return
      }

      console.log('正在讀取使用者設定:', authUserId || currentUserEmail)

      let data: { id: number; favorites: string[] | null } | null = null
      let error: { message?: string } | null = null

      if (authUserId) {
        const result = await supabase
          .from('members')
          .select('id, favorites')
          .eq('auth_user_id', authUserId)
          .maybeSingle()
        data = result.data
        error = result.error
      }

      if (!data && currentUserEmail) {
        const result = await supabase
          .from('members')
          .select('id, favorites')
          .eq('email', currentUserEmail)
          .maybeSingle()
        data = result.data
        error = result.error
      }
      
      if (error) {
        console.error('讀取失敗:', error.message)
      }

      if (data) {
        setUserId(data.id)
        setFavorites(Array.isArray(data.favorites) ? data.favorites : [])
      }
      setLoading(false)
    }

    fetchUser()
  }, [])

  const toggleFavorite = async (path: string) => {
    if (!userId) {
      alert('無法確認您的身份，請嘗試重新登入。')
      return
    }

    let newFavs
    if (favorites.includes(path)) {
      newFavs = favorites.filter(p => p !== path)
    } else {
      newFavs = [...favorites, path]
    }

    setFavorites(newFavs)

    const { error } = await supabase
      .from('members')
      .update({ favorites: newFavs })
      .eq('id', userId)
    
    if (error) {
      console.error('更新失敗:', error)
      alert('更新失敗')
      setFavorites(favorites) // 失敗則還原
    }
  }

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, loading }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}