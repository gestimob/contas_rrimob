import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../utils/masks'
import { generateContaPDF } from '../utils/pdf'
import dayjs from 'dayjs'

interface ContaDetail {
  id: string
  valor: number
  vencimento: string
  status: string
  pessoa: { nome: string }
  tipo: { nome: string }
  descricao: { nome: string }
  boleto_url: string | null
  comprovante_url: string | null
}

interface Config {
  nome_empresa: string
  logo_url: string
}

export default function ContaView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [conta, setConta] = useState<ContaDetail | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    const [contaRes, configRes] = await Promise.all([
      supabase
        .from('contas_pagar')
        .select('*, pessoa:pessoas(nome), tipo:tipos_conta(nome), descricao:descricoes_conta(nome)')
        .eq('id', id)
        .single(),
      supabase.from('configuracoes').select('nome_empresa, logo_url').limit(1).single(),
    ])
    setConta(contaRes.data as ContaDetail)
    setConfig(configRes.data as Config)
    setLoading(false)
  }

  const toggleStatus = async () => {
    if (!conta) return
    const newStatus = conta.status === 'pago' ? 'em_aberto' : 'pago'
    await supabase.from('contas_pagar').update({ status: newStatus }).eq('id', id)
    setConta({ ...conta, status: newStatus })
  }

  const handlePDF = () => {
    if (!conta) return
    generateContaPDF({
      pessoa: conta.pessoa?.nome || '',
      tipo: conta.tipo?.nome || '',
      descricao: conta.descricao?.nome || '',
      valor: Number(conta.valor),
      vencimento: conta.vencimento,
      status: conta.status,
      nomeEmpresa: config?.nome_empresa,
      logoUrl: config?.logo_url,
    })
  }

  const getAttachmentUrl = (path: string | null) => {
    if (!path) return null
    const { data } = supabase.storage.from('anexos').getPublicUrl(path)
    return data.publicUrl
  }

  if (loading || !conta) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isOverdue = conta.status === 'em_aberto' && dayjs(conta.vencimento).isBefore(dayjs(), 'day')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Detalhes da Conta</h1>
        <button onClick={() => navigate('/contas')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Voltar
        </button>
      </div>

      {/* Document-style card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Header stripe */}
        <div className={`h-2 ${conta.status === 'pago' ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />

        <div className="p-6 md:p-8 space-y-6">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <div>
              {conta.status === 'pago' && (
                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-full text-sm">✅ Pago</span>
              )}
              {conta.status === 'em_aberto' && !isOverdue && (
                <span className="px-4 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold rounded-full text-sm">⏳ Em Aberto</span>
              )}
              {isOverdue && (
                <span className="px-4 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold rounded-full text-sm">🔴 Vencido</span>
              )}
            </div>
            <span className="text-sm text-gray-500">ID: {conta.id.slice(0, 8)}...</span>
          </div>

          {/* Main info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Proprietário</p>
                <p className="text-lg font-semibold">{conta.pessoa?.nome}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tipo</p>
                <p className="font-medium">{conta.tipo?.nome}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Descrição</p>
                <p className="font-medium">{conta.descricao?.nome}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Valor</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                  {formatCurrency(Number(conta.valor))}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Vencimento</p>
                <p className="font-medium text-lg">{formatDate(conta.vencimento)}</p>
              </div>
            </div>
          </div>

          {/* Anexos View */}
          {(conta.boleto_url || conta.comprovante_url) && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Anexos Disponíveis</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {conta.boleto_url && (
                  <a
                    href={getAttachmentUrl(conta.boleto_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-700 border-dashed"
                  >
                    <span className="text-2xl">📄</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Boleto Bancário</p>
                      <p className="text-[10px] text-gray-400">Ver arquivo em nova aba</p>
                    </div>
                  </a>
                )}
                {conta.comprovante_url && (
                  <a
                    href={getAttachmentUrl(conta.comprovante_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-700 border-dashed"
                  >
                    <span className="text-2xl">🧾</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Comprovante</p>
                      <p className="text-[10px] text-gray-400">Ver arquivo em nova aba</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePDF}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25"
            >
              📄 Gerar PDF
            </button>
            <button
              onClick={toggleStatus}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 font-medium rounded-xl transition-colors ${
                conta.status === 'pago'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
              }`}
            >
              {conta.status === 'pago' ? '⏳ Marcar como Aberto' : '✅ Marcar como Pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
