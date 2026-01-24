/**
 * Clixer - SQL Editor Hook
 * SQL Editör state yönetimi
 */

import { useState, useCallback } from 'react'
import type { TableInfo, ColumnInfo, QueryResult } from '../types/data'

export interface SqlEditorState {
  sqlQuery: string
  sqlConnectionId: string
  sqlResult: QueryResult | null
  sqlLoading: boolean
  sqlError: string | null
  tables: TableInfo[]
  expandedTable: string | null
  tableColumns: Record<string, ColumnInfo[]>
}

export interface SqlEditorActions {
  setSqlQuery: (v: string) => void
  setSqlConnectionId: (v: string) => void
  setSqlResult: (v: QueryResult | null) => void
  setSqlLoading: (v: boolean) => void
  setSqlError: (v: string | null) => void
  setTables: (v: TableInfo[]) => void
  setExpandedTable: (v: string | null) => void
  setTableColumns: (v: Record<string, ColumnInfo[]>) => void
  addTableColumns: (tableName: string, columns: ColumnInfo[]) => void
  resetSqlEditor: () => void
}

const initialState: SqlEditorState = {
  sqlQuery: 'SELECT * FROM stores LIMIT 10',
  sqlConnectionId: '',
  sqlResult: null,
  sqlLoading: false,
  sqlError: null,
  tables: [],
  expandedTable: null,
  tableColumns: {},
}

export function useSqlEditor(): SqlEditorState & SqlEditorActions {
  const [state, setState] = useState<SqlEditorState>(initialState)

  const setField = useCallback(<K extends keyof SqlEditorState>(key: K, value: SqlEditorState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const addTableColumns = useCallback((tableName: string, columns: ColumnInfo[]) => {
    setState(prev => ({
      ...prev,
      tableColumns: { ...prev.tableColumns, [tableName]: columns }
    }))
  }, [])

  const resetSqlEditor = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setSqlQuery: (v) => setField('sqlQuery', v),
    setSqlConnectionId: (v) => setField('sqlConnectionId', v),
    setSqlResult: (v) => setField('sqlResult', v),
    setSqlLoading: (v) => setField('sqlLoading', v),
    setSqlError: (v) => setField('sqlError', v),
    setTables: (v) => setField('tables', v),
    setExpandedTable: (v) => setField('expandedTable', v),
    setTableColumns: (v) => setField('tableColumns', v),
    addTableColumns,
    resetSqlEditor,
  }
}
