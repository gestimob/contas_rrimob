import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '../utils/masks'
import { generateRelatorioContasPDF } from '../utils/pdf'
import dayjs from 'dayjs'

interface Conta {
  id: string
  valor: number
  vencimento: string
  status: string
  pessoa: { nome: string }
  tipo: { nome: string }
  descricao: { nome: string }
  last_email_id: string | null
}

interface EmailModalProps {
  logId: string
  onClose: () => void
}

function EmailModal({ logId, onClose }: EmailModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEmail() {
      const { data } = await supabase
        .from('log_emails')
        .select('corpo_html, assunto, destinatario, data_hora')
        .eq('id', logId)
        .single()
      
      if (data) setContent(data.corpo_html)
      setLoading(false)
    }
    loadEmail()
  }, [logId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-width-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-lg">Visualizar E-mail Enviado</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Carregando conteúdo...</p>
            </div>
          ) : content ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <iframe 
                srcDoc={content} 
                title="Email Content" 
                className="w-full min-h-[500px] border-none"
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Conteúdo do e-mail não encontrado.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-600/20">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContasPagar() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'todos')
  const [filterData, setFilterData] = useState<string | null>(searchParams.get('data'))
  const [filterDateStart, setFilterDateStart] = useState<string>(searchParams.get('start') || '')
  const [filterDateEnd, setFilterDateEnd] = useState<string>(searchParams.get('end') || '')
  const [filterTipo, setFilterTipo] = useState<string | null>(searchParams.get('tipo'))
  const [filterMes, setFilterMes] = useState<string | null>(searchParams.get('mes'))
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedEmailLog, setSelectedEmailLog] = useState<string | null>(null)

  useEffect(() => {
    setFilterStatus(searchParams.get('status') || 'todos')
    setFilterData(searchParams.get('data'))
    setFilterDateStart(searchParams.get('start') || '')
    setFilterDateEnd(searchParams.get('end') || '')
    setFilterTipo(searchParams.get('tipo'))
    setFilterMes(searchParams.get('mes'))
  }, [searchParams])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    const { data } = await supabase
      .from('contas_pagar')
      .select('*, pessoa:pessoas(nome), tipo:tipos_conta(nome), descricao:descricoes_conta(nome)')
      .order('created_at', { ascending: false })
    setContas((data as Conta[]) || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    setErrorMsg(null)
    const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
    
    if (error) {
      console.error(error)
      setErrorMsg('Erro ao excluir a conta. Tente novamente.')
      setDeleteConfirm(null)
      return
    }

    setContas(prev => prev.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  const handleGeneratePDF = async () => {
    const { data: config } = await supabase.from('configuracoes').select('nome_empresa, logo_url').limit(1).single()

    let filterText = `Status: ${filterLabel(filterStatus)}`
    if (filterDateStart && filterDateEnd) {
      filterText += ` | Período: ${formatDate(filterDateStart)} até ${formatDate(filterDateEnd)}`
    } else if (filterDateStart) {
      filterText += ` | Desde: ${formatDate(filterDateStart)}`
    } else if (filterDateEnd) {
      filterText += ` | Até: ${formatDate(filterDateEnd)}`
    } else if (filterData) {
      filterText += ` | Data: ${formatDate(filterData)}`
    } else {
      filterText += ' | Período: Todos'
    }

    const mappedContas = filtered.map(c => ({
      pessoa: c.pessoa?.nome || '',
      tipo: c.tipo?.nome || '',
      descricao: c.descricao?.nome || '',
      valor: Number(c.valor),
      vencimento: c.vencimento,
      status: c.status
    }))

    const totalAberto = filtered.filter(c => c.status === 'em_aberto').reduce((acc, c) => acc + Number(c.valor), 0)
    const totalPago = filtered.filter(c => c.status === 'pago').reduce((acc, c) => acc + Number(c.valor), 0)
    const totalGeral = totalAberto + totalPago

    await generateRelatorioContasPDF({
      contas: mappedContas,
      filtrosInfo: filterText,
      totalGeral,
      totalPago,
      totalAberto,
      nomeEmpresa: config?.nome_empresa,
      logoUrl: config?.logo_url
    })
  }

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (!value || value === 'todos') {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams)
  }

  const filtered = contas.filter(c => {
    // Smart search normalization
    const normalize = (str: string | null | undefined) => {
      if (!str) return ''
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
    }

    const searchNorm = normalize(search)

    // Get exact dynamic status text shown on screen
    let statusText = 'Em Aberto'
    const diff = dayjs(c.vencimento).startOf('day').diff(dayjs().startOf('day'), 'day')
    if (c.status === 'pago') {
      statusText = 'Pago'
    } else if (dayjs(c.vencimento).isBefore(dayjs(), 'day')) {
      statusText = 'Vencido'
    } else if (diff >= 0 && diff <= 3) {
      statusText = diff === 0 ? 'Vence em hoje' : diff === 1 ? 'Vence em 1 dia' : `Vence em ${diff} dias`
    }

    const recordStr = [
      c.pessoa?.nome,
      c.descricao?.nome,
      c.tipo?.nome,
      formatDate(c.vencimento),
      formatCurrency(Number(c.valor)),
      statusText
    ].map(normalize).join(' ')

    const matchSearch = searchNorm === '' || recordStr.includes(searchNorm)

    let matchStatus = true
    if (filterStatus === 'em_aberto') {
      matchStatus = c.status === 'em_aberto'
    } else if (filterStatus === 'pago') {
      matchStatus = c.status === 'pago'
    } else if (filterStatus === 'vencido') {
      matchStatus = c.status === 'em_aberto' && dayjs(c.vencimento).isBefore(dayjs(), 'day')
    } else if (filterStatus === 'vencendo_3_dias') {
      const diff = dayjs(c.vencimento).startOf('day').diff(dayjs().startOf('day'), 'day')
      matchStatus = c.status === 'em_aberto' && diff >= 0 && diff <= 3
    }

    let matchDate = true
    if (filterDateStart && filterDateEnd) {
      matchDate = c.vencimento >= filterDateStart && c.vencimento <= filterDateEnd
    } else if (filterDateStart) {
      matchDate = c.vencimento >= filterDateStart
    } else if (filterDateEnd) {
      matchDate = c.vencimento <= filterDateEnd
    } else if (filterData) {
      matchDate = c.vencimento === filterData
    }

    let matchTipo = true
    if (filterTipo) {
      matchTipo = c.tipo?.nome === filterTipo
    }

    let matchMes = true
    if (filterMes) {
      matchMes = dayjs(c.vencimento).format('MMM/YY') === filterMes
    }

    return matchSearch && matchStatus && matchDate && matchTipo && matchMes
  })

  const statusBadge = (status: string, vencimento: string) => {
    const diff = dayjs(vencimento).startOf('day').diff(dayjs().startOf('day'), 'day')
    if (status === 'pago') {
      return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full">Pago</span>
    }
    if (dayjs(vencimento).isBefore(dayjs(), 'day')) {
      return <span className="px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">Vencido</span>
    }
    if (diff >= 0 && diff <= 3) {
      return <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold rounded-full">Vence em {diff === 0 ? 'hoje' : diff === 1 ? '1 dia' : `${diff} dias`}</span>
    }
    return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-full">Em Aberto</span>
  }

  const filterLabel = (value: string) => {
    const labels: Record<string, string> = {
      todos: 'Todos',
      em_aberto: 'Em Aberto',
      pago: 'Pago',
      vencido: 'Vencidos',
      vencendo_3_dias: 'Vencendo em 3 dias',
    }
    return labels[value] || value
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-danger-500/10 border border-danger-500/20 text-danger-500 px-4 py-3 rounded-xl flex items-center justify-between">
          <p className="text-sm font-medium">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-danger-500 hover:text-danger-700">✕</button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Contas a Pagar</h1>
          {(filterStatus !== 'todos' || filterData || filterTipo || filterMes) && (
            <p className="text-sm text-gray-500 mt-1">
              {filterStatus !== 'todos' && <span>Status: <span className="font-medium text-primary-500">{filterLabel(filterStatus)}</span></span>}
              {filterStatus !== 'todos' && (filterData || filterDateStart || filterDateEnd || filterTipo || filterMes) && <span className="mx-2">•</span>}
              {filterDateStart && filterDateEnd ? (
                <span>Período: <span className="font-medium text-primary-500">{formatDate(filterDateStart)} a {formatDate(filterDateEnd)}</span></span>
              ) : (
                <>
                  {filterDateStart && <span>Início: <span className="font-medium text-primary-500">{formatDate(filterDateStart)}</span></span>}
                  {filterDateStart && filterDateEnd && <span className="mx-2">•</span>}
                  {filterDateEnd && <span>Fim: <span className="font-medium text-primary-500">{formatDate(filterDateEnd)}</span></span>}
                </>
              )}
              {(filterDateStart || filterDateEnd) && (filterData || filterTipo || filterMes) && <span className="mx-2">•</span>}
              {filterData && <span>Data: <span className="font-medium text-primary-500">{formatDate(filterData)}</span></span>}
              {filterData && (filterTipo || filterMes) && <span className="mx-2">•</span>}
              {filterTipo && <span>Tipo: <span className="font-medium text-primary-500">{filterTipo}</span></span>}
              {filterTipo && filterMes && <span className="mx-2">•</span>}
              {filterMes && <span>Mês: <span className="font-medium text-primary-500">{filterMes}</span></span>}
              
              <button onClick={() => { setSearchParams({}); setSearch(''); }} className="ml-3 text-xs text-gray-400 hover:text-gray-600 underline">
                limpar tudo
              </button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePDF}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
          >
            <span>🖨️</span> Gerar PDF
          </button>
          <Link
            to="/contas/novo"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25"
          >
            <span>+</span> Nova Conta
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 bg-gray-50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por descrição, proprietário ou valor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-3 pl-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Período:</span>
              <input
                type="date"
                value={filterDateStart}
                onChange={e => handleFilterChange('start', e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm w-32 dark:color-white"
                title="Data de Início"
              />
              <span className="text-gray-300">→</span>
              <input
                type="date"
                value={filterDateEnd}
                onChange={e => handleFilterChange('end', e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm w-32 dark:color-white"
                title="Data de Fim"
              />
            </div>

            <select
              value={filterStatus}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all text-sm font-semibold shadow-sm min-w-[140px]"
            >
              <option value="todos">Todos os Status</option>
              <option value="em_aberto">💰 Em Aberto</option>
              <option value="pago">✅ Pago</option>
              <option value="vencido">⚠️ Vencidos</option>
              <option value="vencendo_3_dias">⏳ Vencendo em 3 dias</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-4">💰</p>
          <p className="text-lg">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Proprietário</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Tipo</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Descrição</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Valor</th>
                  <th className="text-center px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Vencimento</th>
                  <th className="text-center px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Status</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4 font-medium">{c.pessoa?.nome}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{c.tipo?.nome}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{c.descricao?.nome}</td>
                    <td className="px-5 py-4 text-right font-semibold">{formatCurrency(Number(c.valor))}</td>
                    <td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">{formatDate(c.vencimento)}</td>
                    <td className="px-5 py-4 text-center">{statusBadge(c.status, c.vencimento)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirm === c.id ? (
                          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20">
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium hidden sm:inline">Excluir?</span>
                            <button onClick={() => handleDelete(c.id)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors">Sim</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded transition-colors">Não</button>
                          </div>
                        ) : (
                          <>
                            {c.last_email_id && (
                              <button 
                                onClick={() => setSelectedEmailLog(c.last_email_id)} 
                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors text-blue-500" 
                                title="Ver E-mail"
                              >
                                ✉️
                              </button>
                            )}
                            <Link to={`/contas/${c.id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Visualizar">👁</Link>
                            <Link to={`/contas/${c.id}/editar`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Editar">✏️</Link>
                            <button onClick={() => setDeleteConfirm(c.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-danger-500" title="Excluir">🗑</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(c => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.descricao?.nome}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{c.pessoa?.nome} · {c.tipo?.nome}</p>
                  </div>
                  {statusBadge(c.status, c.vencimento)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-lg">{formatCurrency(Number(c.valor))}</span>
                  <span className="text-gray-500">{formatDate(c.vencimento)}</span>
                </div>
                <div className="flex items-center justify-end gap-1 pt-1">
                  {deleteConfirm === c.id ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20">
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">Excluir?</span>
                      <button onClick={() => handleDelete(c.id)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition-colors">Sim</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-gray-600 dark:text-gray-400 px-2 py-1 rounded transition-colors">Não</button>
                    </div>
                  ) : (
                    <>
                      {c.last_email_id && (
                        <button 
                          onClick={() => setSelectedEmailLog(c.last_email_id)} 
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors text-blue-500 text-sm"
                        >
                          ✉️
                        </button>
                      )}
                      <Link to={`/contas/${c.id}`} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm">👁</Link>
                      <Link to={`/contas/${c.id}/editar`} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm">✏️</Link>
                      <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-danger-500 text-sm">🗑</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedEmailLog && (
        <EmailModal 
          logId={selectedEmailLog} 
          onClose={() => setSelectedEmailLog(null)} 
        />
      )}
    </div>
  )
}
