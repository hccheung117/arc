import { createContext, useContext } from 'react'

const TiptapContext = createContext(null)
export const TiptapProvider = TiptapContext.Provider
export const useTiptap = () => useContext(TiptapContext)
