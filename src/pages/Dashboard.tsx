import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '../utils/masks'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import Calendar from 'react-calendar'
import './DashboardCalendar.css'

dayjs.extend(isBetween)

interface Conta {
  id: string
  valor: number
  vencimento: string
  status: string
  pessoa_id: string
  pessoa: { nome: string }
  tipo: { nome: string }
  descricao: { nome: string }
}

interface Pessoa {
  id: string
  nome: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contas, setContas] = useState<Conta[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Filters State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedPessoa, setSelectedPessoa] = useState('todos')

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    const [contasRes, pessoasRes] = await Promise.all([
      supabase
        .from('contas_pagar')
        .select('*, pessoa:pessoas(nome), tipo:tipos_conta(nome), descricao:descricoes_conta(nome)')
        .eq('user_id', user!.id)
        .order('vencimento', { ascending: true }),
      supabase
        .from('pessoas')
        .select('id, nome')
        .eq('user_id', user!.id)
        .order('nome')
    ])

    setContas((contasRes.data as Conta[]) || [])
    setPessoas(pessoasRes.data || [])
    setLoading(false)
  }

  const handleSendNotification = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const { data, error } = await supabase.functions.invoke(`send-bill-alerts?manual=true&userId=${user!.id}`, {
        method: 'POST',
        body: { manual: true, userId: user!.id }
      })
      if (!error) {
        setSendResult({ ok: true, msg: data.message || 'Notificação enviada!' })
      } else {
        setSendResult({ ok: false, msg: error.message || 'Erro ao enviar' })
      }
    } catch (err) {
      setSendResult({ ok: false, msg: 'Erro de conexão' })
    }
    setSending(false)
    setTimeout(() => setSendResult(null), 5000)
  }

  // Apply filters
  const filteredContas = contas.filter(c => {
    let matchPessoa = true
    if (selectedPessoa !== 'todos') {
      matchPessoa = c.pessoa_id === selectedPessoa
    }

    let matchDate = true
    if (startDate || endDate) {
      const vDate = dayjs(c.vencimento)
      if (startDate && endDate) {
        matchDate = vDate.isBetween(dayjs(startDate), dayjs(endDate), 'day', '[]')
      } else if (startDate) {
        matchDate = vDate.isAfter(dayjs(startDate).subtract(1, 'day'), 'day')
      } else if (endDate) {
        matchDate = vDate.isBefore(dayjs(endDate).add(1, 'day'), 'day')
      }
    }

    return matchPessoa && matchDate
  })

  // Calculations based on FILTERED data
  const total = filteredContas.length
  const totalPago = filteredContas.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0)
  const totalAberto = filteredContas.filter(c => c.status === 'em_aberto').reduce((s, c) => s + Number(c.valor), 0)
  const totalVencido = filteredContas.filter(c => c.status === 'em_aberto' && dayjs(c.vencimento).isBefore(dayjs(), 'day')).reduce((s, c) => s + Number(c.valor), 0)

  // Bills due within 2 days (alert)
  const alertBills = filteredContas.filter(c => {
    if (c.status !== 'em_aberto') return false
    const diff = dayjs(c.vencimento).startOf('day').diff(dayjs().startOf('day'), 'day')
    return diff >= 0 && diff <= 2
  })

  // Bills due within 3 days
  const bills3Days = filteredContas.filter(c => {
    if (c.status !== 'em_aberto') return false
    const diff = dayjs(c.vencimento).startOf('day').diff(dayjs().startOf('day'), 'day')
    return diff >= 0 && diff <= 3
  })
  const total3Days = bills3Days.reduce((s, c) => s + Number(c.valor), 0)

  // Chart data: by type
  const typeMap: Record<string, number> = {}
  filteredContas.forEach(c => {
    const name = c.tipo?.nome || 'Sem tipo'
    typeMap[name] = (typeMap[name] || 0) + Number(c.valor)
  })
  const chartByType = Object.entries(typeMap).map(([name, valor]) => ({ name, valor }))

  // Chart data: by month
  const monthMap: Record<string, number> = {}
  filteredContas.forEach(c => {
    const month = dayjs(c.vencimento).format('MMM/YY')
    monthMap[month] = (monthMap[month] || 0) + Number(c.valor)
  })
  // Sort monthMap chronologically if needed, but Recharts usually displays them in insertion order. 
  // Let's sort them.
  const chartByMonth = Object.entries(monthMap)
    .sort(([a], [b]) => {
       const [mA, yA] = a.split('/')
       const [mB, yB] = b.split('/')
       const dA = dayjs(`20${yA}-${mA}-01`, 'YYYY-MMM-DD') // Approximation for sorting
       const dB = dayjs(`20${yB}-${mB}-01`, 'YYYY-MMM-DD')
       return dA.unix() - dB.unix()
    })
    .map(([name, valor]) => ({ name, valor }))

  const cards = [
    { label: 'Total de Contas', value: total.toString(), icon: '📋', color: 'from-blue-500 to-blue-700', link: '/contas' },
    { label: 'Total Pago', value: formatCurrency(totalPago), icon: '✅', color: 'from-emerald-500 to-emerald-700', link: '/contas?status=pago' },
    { label: 'Total em Aberto', value: formatCurrency(totalAberto), icon: '⏳', color: 'from-amber-500 to-amber-700', link: '/contas?status=em_aberto' },
    { label: 'Total Vencido', value: formatCurrency(totalVencido), icon: '🔴', color: 'from-red-500 to-red-700', link: '/contas?status=vencido' },
    { label: 'Vencendo em 3 dias', value: `${bills3Days.length} conta${bills3Days.length !== 1 ? 's' : ''} · ${formatCurrency(total3Days)}`, icon: '⚡', color: 'from-purple-500 to-purple-700', link: '/contas?status=vencendo_3_dias' },
  ]

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedPessoa('todos')
  }

  // Set up calendar data based on UNFILTERED data so the calendar shows all possible bills
  const billsByDateMap: Record<string, boolean> = {}
  contas.forEach(c => {
    if (c.status === 'em_aberto') {
      billsByDateMap[c.vencimento] = true
    }
  })

  // Function to determine calendar tile classes
  const tileClassName = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      // Create a date from the calendar input, keeping the local timezone parsing consistent
      const offset = date.getTimezoneOffset()
      const localDate = new Date(date.getTime() - (offset * 60 * 1000))
      const dateString = localDate.toISOString().split('T')[0]
      
      if (billsByDateMap[dateString]) {
        return 'has-bills text-white font-bold bg-primary-500 border-primary-600 rounded-lg hover:bg-primary-600'
      }
    }
    return null
  }

  // Navigation handler when user clicks a date on the calendar
  const handleCalendarClick = (date: Date) => {
    const offset = date.getTimezoneOffset()
    const localDate = new Date(date.getTime() - (offset * 60 * 1000))
    const dateString = localDate.toISOString().split('T')[0]
    
    if (billsByDateMap[dateString]) {
      // If there are bills, navigate to bills list and filter by that exact day
      navigate(`/contas?data=${dateString}`)
    } else {
      // If no bills, navigate to create a new bill pre-filled with that date
      navigate(`/contas/novo?data=${dateString}`)
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {sendResult && (
            <span className={`text-sm font-medium ${sendResult.ok ? 'text-success-500' : 'text-danger-500'}`}>
              {sendResult.ok ? '✅' : '❌'} {sendResult.msg}
            </span>
          )}
          <button
            onClick={handleSendNotification}
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25 text-sm"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>📧 Enviar Notificação</>
            )}
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Proprietário</label>
            <select
              value={selectedPessoa}
              onChange={e => setSelectedPessoa(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500/50 cursor-pointer text-sm"
            >
              <option value="todos">Todos os proprietários</option>
              {pessoas.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500/50 text-sm"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500/50 text-sm"
            />
          </div>

          {(startDate || endDate || selectedPessoa !== 'todos') && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-danger-500 hover:bg-danger-500/10 rounded-xl transition-colors shrink-0 h-10"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Top Area: Calendar (30%) + Summary Cards (70%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Calendar - Left Side (30%) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-5 lg:col-span-4 flex flex-col items-center">
          <h3 className="text-lg font-semibold w-full mb-4">Calendário de Vencimentos</h3>
          <div className="w-full flex justify-center custom-calendar-wrapper">
             <Calendar
                onClickDay={handleCalendarClick}
                tileClassName={tileClassName}
                locale="pt-BR"
             />
          </div>
          <p className="text-xs text-center text-gray-500 mt-4 leading-relaxed">
             Dias com contas aparecem em destaque. Clique num dia para filtrar ou adicionar.
          </p>
        </div>

        {/* Summary Cards - Right Side (70%) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Top Row: 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.slice(0, 3).map(card => (
              <Link
                key={card.label}
                to={card.link}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col items-center text-center justify-between"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-xl shadow-lg shadow-current/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 mb-4`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight mb-1">{card.value}</p>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Bottom Row: 2 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.slice(3, 5).map(card => (
              <Link
                key={card.label}
                to={card.link}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col items-center text-center justify-between"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-xl shadow-lg shadow-current/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 mb-5`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-4xl font-bold tracking-tight mb-2">{card.value}</p>
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Alert Card */}
      {alertBills.length > 0 && (
        <div className="animate-pulse-alert bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-5">
          <h3 className="text-lg font-bold text-red-500 flex items-center gap-2 mb-3">
            ⚠ Contas prestes a vencer
          </h3>
          <div className="space-y-2">
            {alertBills.map(bill => (
              <Link
                key={bill.id}
                to={`/contas/${bill.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-red-500/5 rounded-xl p-3 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="font-semibold">{bill.descricao?.nome}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{bill.pessoa?.nome}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold text-red-500">{formatCurrency(Number(bill.valor))}</span>
                  <span className="text-gray-500">{formatDate(bill.vencimento)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Charts Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - by type */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-5 h-full">
          <h3 className="text-lg font-semibold mb-4">Contas por Tipo</h3>
          {chartByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart 
                data={chartByType}
                className="cursor-pointer"
                onClick={(e) => {
                  if (e && e.activeLabel) {
                    navigate(`/contas?tipo=${encodeURIComponent(e.activeLabel)}`)
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#f3f4f6' }}
                />
                <Bar 
                  dataKey="valor" 
                  fill="#3b82f6" 
                  radius={[8, 8, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">Nenhum dado para o filtro selecionado</p>
          )}
        </div>

        {/* Line Chart - by month */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-5 h-full">
          <h3 className="text-lg font-semibold mb-4">Contas por Mês</h3>
          {chartByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart 
                data={chartByMonth}
                className="cursor-pointer"
                onClick={(e) => {
                  if (e && e.activeLabel) {
                    navigate(`/contas?mes=${encodeURIComponent(e.activeLabel)}`)
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#f3f4f6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ fill: '#3b82f6', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">Nenhum dado para o filtro selecionado</p>
          )}
        </div>
      </div>
    </div>
  )
}
