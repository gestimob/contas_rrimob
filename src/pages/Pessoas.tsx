import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { maskCPF, maskPhone } from '../utils/masks'

interface Pessoa {
  id: string
  nome: string
  cpf: string
  rg: string
  email: string
  whatsapp: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  complemento: string
}

export default function Pessoas() {
  const { user } = useAuth()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    const { data } = await supabase
      .from('pessoas')
      .select('*')
      .eq('user_id', user!.id)
      .order('nome')
    setPessoas(data || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    setErrorMsg(null)
    
    const { error } = await supabase.from('pessoas').delete().eq('id', id)
    
    if (error) {
      console.error(error)
      setErrorMsg('Erro ao excluir. Pode haver contas vinculadas a este proprietário.')
      setDeleteConfirm(null)
      return
    }

    setPessoas(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  const filtered = pessoas.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.cpf?.includes(search) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  const whatsappLink = (phone: string) => {
    const digits = phone?.replace(/\D/g, '') || ''
    return digits ? `https://wa.me/55${digits}` : '#'
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
        <h1 className="text-2xl md:text-3xl font-bold">Proprietários</h1>
        <Link
          to="/pessoas/novo"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25"
        >
          <span>+</span> Novo Proprietário
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-4">👥</p>
          <p className="text-lg">Nenhum proprietário cadastrado</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Nome</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">CPF</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Email</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">WhatsApp</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Cidade</th>
                  <th className="text-right px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4 font-medium">{p.nome}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{p.cpf ? maskCPF(p.cpf) : '-'}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{p.email || '-'}</td>
                    <td className="px-5 py-4">
                      {p.whatsapp ? (
                        <a href={whatsappLink(p.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-success-500 hover:text-success-600 font-medium">
                          📱 {maskPhone(p.whatsapp)}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{p.cidade ? `${p.cidade}/${p.estado}` : '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirm === p.id ? (
                          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20">
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium hidden sm:inline">Excluir?</span>
                            <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors">Sim</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded transition-colors">Não</button>
                          </div>
                        ) : (
                          <>
                            <Link to={`/pessoas/${p.id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Visualizar">👁</Link>
                            <Link to={`/pessoas/${p.id}/editar`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Editar">✏️</Link>
                            <button onClick={() => setDeleteConfirm(p.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-danger-500" title="Excluir">🗑</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(p => (
              <div key={p.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.nome}</span>
                  <div className="flex items-center gap-1">
                    {deleteConfirm === p.id ? (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20">
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">Excluir?</span>
                        <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition-colors">Sim</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-gray-600 dark:text-gray-400 px-2 py-1 rounded transition-colors">Não</button>
                      </div>
                    ) : (
                      <>
                        <Link to={`/pessoas/${p.id}`} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm">👁</Link>
                        <Link to={`/pessoas/${p.id}/editar`} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm">✏️</Link>
                        <button onClick={() => setDeleteConfirm(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-danger-500 text-sm">🗑</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                  {p.cpf && <p>CPF: {maskCPF(p.cpf)}</p>}
                  {p.email && <p>{p.email}</p>}
                  {p.whatsapp && (
                    <a href={whatsappLink(p.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-success-500 block">
                      📱 {maskPhone(p.whatsapp)}
                    </a>
                  )}
                  {p.cidade && <p>📍 {p.cidade}/{p.estado}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
