import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const configSchema = z.object({
  emails: z.array(z.string().email('Email inválido')).min(1, 'Adicione pelo menos um email'),
})

type ConfigForm = z.infer<typeof configSchema>

export default function Configuracoes() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'geral' | 'log' | 'usuarios'>('geral')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [configId, setConfigId] = useState<string | null>(null)
  const [emails, setEmails] = useState<string[]>([''])
  const [emailErrors, setEmailErrors] = useState<string[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [triggeringManual, setTriggeringManual] = useState(false)
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [newUser, setNewUser] = useState({ nome: '', email: '', password: '', ativo: true })
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    if (user) {
      loadConfig()
      if (activeTab === 'log') loadLogs()
      if (activeTab === 'usuarios') loadUsers()
    }
  }, [user, activeTab])

  const loadConfig = async () => {
    const { data } = await supabase
      .from('configuracoes')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (data) {
      setConfigId(data.id)
      const savedEmails = data.email_notificacao
        ? data.email_notificacao.split(',').map((e: string) => e.trim()).filter(Boolean)
        : ['']
      setEmails(savedEmails.length > 0 ? savedEmails : [''])
    }
  }

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('log_emails')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(50)
    
    if (error) console.error('Error loading logs:', error)
    setLogs(data || [])
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('usuarios_sistema')
      .select('*')
      .order('created_at', { ascending: true })
    setUsersList(data || [])
  }

  const handleToggleUser = async (id: string, currentStatus: boolean) => {
    await supabase.from('usuarios_sistema').update({ ativo: !currentStatus }).eq('id', id)
    setUsersList(prev => prev.map(u => u.id === id ? { ...u, ativo: !currentStatus } : u))
  }

  const triggerManualAlerts = async () => {
    setTriggeringManual(true)
    try {
      const { data, error } = await supabase.functions.invoke(`send-bill-alerts?manual=true&userId=${user!.id}`, {
        method: 'POST',
        body: { manual: true, userId: user!.id }
      })
      if (error) throw error
      alert('Alertas enviados com sucesso!')
      if (activeTab === 'log') loadLogs()
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar alertas.')
    } finally {
      setTriggeringManual(false)
    }
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleAddEmail = () => {
    setEmails(prev => [...prev, ''])
  }

  const handleRemoveEmail = (index: number) => {
    if (emails.length <= 1) return
    setEmails(prev => prev.filter((_, i) => i !== index))
    setEmailErrors(prev => prev.filter((_, i) => i !== index))
  }

  const handleEmailChange = (index: number, value: string) => {
    setEmails(prev => prev.map((e, i) => i === index ? value : e))
    setEmailErrors(prev => {
      const newErrors = [...prev]
      newErrors[index] = ''
      return newErrors
    })
  }

  const onSubmit = async () => {
    // Validate all emails
    const errors: string[] = []
    let hasError = false
    emails.forEach((email, i) => {
      if (!email.trim()) {
        errors[i] = 'Email é obrigatório'
        hasError = true
      } else if (!validateEmail(email.trim())) {
        errors[i] = 'Email inválido'
        hasError = true
      } else {
        errors[i] = ''
      }
    })
    setEmailErrors(errors)
    if (hasError) return

    setLoading(true)
    setSaved(false)

    const payload = {
      email_notificacao: emails.map(e => e.trim()).filter(Boolean).join(','),
      user_id: user!.id,
    }

    if (configId) {
      await supabase.from('configuracoes').update(payload).eq('id', configId)
    } else {
      const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).maybeSingle()
      if (existing) {
        await supabase.from('configuracoes').update(payload).eq('id', existing.id)
        setConfigId(existing.id)
      } else {
        const { data: created } = await supabase.from('configuracoes').insert(payload).select().single()
        if (created) setConfigId(created.id)
      }
    }

    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-system-user', {
        body: newUser
      })
      if (error) throw error
      alert('Usuário criado com sucesso!')
      setIsAddingUser(false)
      setNewUser({ nome: '', email: '', password: '', ativo: true })
      loadUsers()
    } catch (err) {
      console.error(err)
      alert('Erro ao criar usuário: ' + (err as any).message)
    } finally {
      setCreatingUser(false)
    }
  }

  const inputClass = `w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all`

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <h1 className="text-2xl md:text-3xl font-bold font-head">Configurações</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('geral')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'geral' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Notificações
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'log' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Log de Envios
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'usuarios' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Gestão de Usuários
        </button>
      </div>

      {activeTab === 'geral' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-medium">Emails de Notificação</label>
                <p className="text-xs text-gray-500 mt-0.5">Emails que receberão alertas diários de contas a vencer</p>
              </div>
              <button
                type="button"
                onClick={handleAddEmail}
                className="text-xs px-3 py-1.5 bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 rounded-lg font-medium transition-colors"
              >
                + Adicionar email
              </button>
            </div>

            <div className="space-y-3">
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={email}
                      onChange={e => handleEmailChange(index, e.target.value)}
                      className={`${inputClass} ${emailErrors[index] ? 'border-danger-500 focus:ring-danger-500/50' : ''}`}
                      placeholder="email@exemplo.com"
                    />
                    {emailErrors[index] && (
                      <p className="text-danger-500 text-xs mt-1">{emailErrors[index]}</p>
                    )}
                  </div>
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(index)}
                      className="px-3 py-3 text-danger-500 hover:bg-danger-500/10 rounded-xl transition-colors"
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h4 className="text-sm font-semibold">Gatilho Manual</h4>
              <p className="text-xs text-gray-400">Envie os alertas de vencimento agora para todos os proprietários.</p>
            </div>
            <button
              onClick={triggerManualAlerts}
              disabled={triggeringManual}
              className="w-full sm:w-auto px-4 py-2 bg-amber-500/10 text-amber-600 text-xs font-semibold rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition-all border border-amber-500/20"
            >
              {triggeringManual ? 'Enviando...' : '⚡ Enviar Alertas Agora'}
            </button>
          </div>

          <div className="flex justify-end border-t border-gray-100 dark:border-gray-800 pt-6">
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-600/25"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Data/Hora</th>
                <th className="px-6 py-4 font-semibold">Método</th>
                <th className="px-6 py-4 font-semibold">Destinatário</th>
                <th className="px-6 py-4 font-semibold">Assunto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map(log => (
                <tr key={log.id} className="text-sm">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(log.data_hora).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.metodo === 'manual' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      {log.metodo}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{log.destinatario}</td>
                  <td className="px-6 py-4 truncate max-w-xs">{log.assunto}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic text-sm">Nenhum log de envio encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          {/* New User Form Inline */}
          {isAddingUser ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-primary-500/30 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="p-2 bg-primary-500/10 text-primary-500 rounded-lg text-sm">👤</span>
                  Cadastrar Novo Usuário
                </h3>
                <button 
                  onClick={() => setIsAddingUser(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={newUser.nome}
                    onChange={e => setNewUser(prev => ({ ...prev, nome: e.target.value }))}
                    className={inputClass}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">Email</label>
                  <input
                    required
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className={inputClass}
                    placeholder="joao@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">Senha Inicial</label>
                  <input
                    required
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-end pb-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newUser.ativo}
                      onChange={e => setNewUser(prev => ({ ...prev, ativo: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-primary-600 transition-colors">
                      Usuário Ativo
                    </span>
                  </label>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="px-6 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-600/25"
                  >
                    {creatingUser ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setIsAddingUser(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all shadow-md shadow-primary-500/20 text-sm font-medium"
              >
                <span>+</span> Novo Usuário
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold">Usuários com Acesso</h3>
              <p className="text-[10px] text-gray-400 italic">Lista de usuários cadastrados no sistema.</p>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Usuário</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {usersList.map(u => (
                  <tr key={u.id} className="text-sm">
                    <td className="px-6 py-4 font-medium">{u.nome} {u.auth_user_id === user!.id && '(Você)'}</td>
                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.ativo ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleUser(u.id, u.ativo)}
                        disabled={u.auth_user_id === user!.id}
                        className="text-xs font-semibold text-primary-500 hover:text-primary-600 disabled:opacity-30"
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce">
          ✅ Configurações salvas!
        </div>
      )}
    </div>
  )
}
