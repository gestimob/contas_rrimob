import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { maskCurrency, parseCurrency } from '../utils/masks'

const contaSchema = z.object({
  pessoa_id: z.string().min(1, 'Selecione uma pessoa'),
  tipo_id: z.string().min(1, 'Selecione um tipo'),
  descricao_id: z.string().min(1, 'Selecione uma descrição'),
  valor: z.string().min(1, 'Valor é obrigatório'),
  vencimento: z.string().min(1, 'Vencimento é obrigatório'),
  status: z.string().default('em_aberto'),
  boleto_url: z.string().optional().nullable(),
  comprovante_url: z.string().optional().nullable(),
})

type ContaFormData = z.infer<typeof contaSchema>

interface SelectOption { id: string; nome: string }

export default function ContaForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isEdit = !!id && id !== 'novo'
  const [loading, setLoading] = useState(false)

  const [pessoas, setPessoas] = useState<SelectOption[]>([])
  const [tipos, setTipos] = useState<SelectOption[]>([])
  const [descricoes, setDescricoes] = useState<SelectOption[]>([])

  const [newTipo, setNewTipo] = useState('')
  const [showNewTipo, setShowNewTipo] = useState(false)
  const [newDescricao, setNewDescricao] = useState('')
  const [showNewDescricao, setShowNewDescricao] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null) // 'boleto' | 'comprovante' | null

  const [searchParams] = useSearchParams()

  const { register, handleSubmit, setValue, watch, control, reset, formState: { errors } } = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: { status: 'em_aberto', vencimento: searchParams.get('data') || '' },
  })

  useEffect(() => {
    if (user) {
      loadOptions()
      if (isEdit) loadConta()
    }
  }, [user, id])

  const loadOptions = async () => {
    const [p, t, d] = await Promise.all([
      supabase.from('pessoas').select('id, nome').order('nome'),
      supabase.from('tipos_conta').select('id, nome').order('nome'),
      supabase.from('descricoes_conta').select('id, nome').order('nome'),
    ])
    setPessoas(p.data || [])
    setTipos(t.data || [])
    setDescricoes(d.data || [])
  }

  const loadConta = async () => {
    const { data } = await supabase.from('contas_pagar').select('*').eq('id', id).single()
    if (data) {
      reset({
        pessoa_id: data.pessoa_id,
        tipo_id: data.tipo_id,
        descricao_id: data.descricao_id,
        valor: maskCurrency(String(Math.round(data.valor * 100))),
        vencimento: data.vencimento,
        status: data.status,
        boleto_url: data.boleto_url,
        comprovante_url: data.comprovante_url,
      })
    }
  }

  const handleAddTipo = async () => {
    if (!newTipo.trim()) return
    const { data } = await supabase.from('tipos_conta').insert({ nome: newTipo.trim(), user_id: user!.id }).select().single()
    if (data) {
      setTipos(prev => [...prev, data])
      setValue('tipo_id', data.id)
      setNewTipo('')
      setShowNewTipo(false)
    }
  }

  const handleAddDescricao = async () => {
    if (!newDescricao.trim()) return
    const { data } = await supabase.from('descricoes_conta').insert({ nome: newDescricao.trim(), user_id: user!.id }).select().single()
    if (data) {
      setDescricoes(prev => [...prev, data])
      setValue('descricao_id', data.id)
      setNewDescricao('')
      setShowNewDescricao(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fieldName: 'boleto_url' | 'comprovante_url') => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setUploading(fieldName === 'boleto_url' ? 'boleto' : 'comprovante')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}_${fieldName}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('anexos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('anexos')
        .getPublicUrl(fileName)

      setValue(fieldName, fileName) // We store the path, not full URL for easier management
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Erro ao carregar arquivo. Tente novamente.')
    } finally {
      setUploading(null)
    }
  }

  const onSubmit = async (data: ContaFormData) => {
    setLoading(true)
    const payload = {
      pessoa_id: data.pessoa_id,
      tipo_id: data.tipo_id,
      descricao_id: data.descricao_id,
      valor: parseCurrency(data.valor),
      vencimento: data.vencimento,
      status: data.status,
      boleto_url: data.boleto_url,
      comprovante_url: data.comprovante_url,
      user_id: user!.id,
    }

    if (isEdit) {
      await supabase.from('contas_pagar').update(payload).eq('id', id)
    } else {
      await supabase.from('contas_pagar').insert(payload)
    }
    navigate('/contas')
  }

  const inputClass = `w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all`
  const selectClass = `${inputClass} appearance-none`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">{isEdit ? 'Editar Conta' : 'Nova Conta'}</h1>
        <button onClick={() => navigate('/contas')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 space-y-5">
        {/* Pessoa */}
        <div>
          <label className="block text-sm font-medium mb-2">Proprietário *</label>
          <select {...register('pessoa_id')} className={selectClass}>
            <option value="">Selecione...</option>
            {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {errors.pessoa_id && <p className="text-danger-500 text-xs mt-1">{errors.pessoa_id.message}</p>}
        </div>

        {/* Tipo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Tipo *</label>
            <button type="button" onClick={() => setShowNewTipo(!showNewTipo)} className="text-xs text-primary-500 hover:text-primary-600">
              {showNewTipo ? 'Cancelar' : '+ Novo tipo'}
            </button>
          </div>
          {showNewTipo ? (
            <div className="flex gap-2">
              <input value={newTipo} onChange={e => setNewTipo(e.target.value)} className={inputClass} placeholder="Nome do tipo" />
              <button type="button" onClick={handleAddTipo} className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors whitespace-nowrap">
                Adicionar
              </button>
            </div>
          ) : (
            <select {...register('tipo_id')} className={selectClass}>
              <option value="">Selecione...</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          {errors.tipo_id && <p className="text-danger-500 text-xs mt-1">{errors.tipo_id.message}</p>}
        </div>

        {/* Descrição */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Descrição *</label>
            <button type="button" onClick={() => setShowNewDescricao(!showNewDescricao)} className="text-xs text-primary-500 hover:text-primary-600">
              {showNewDescricao ? 'Cancelar' : '+ Nova descrição'}
            </button>
          </div>
          {showNewDescricao ? (
            <div className="flex gap-2">
              <input value={newDescricao} onChange={e => setNewDescricao(e.target.value)} className={inputClass} placeholder="Nome da descrição" />
              <button type="button" onClick={handleAddDescricao} className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors whitespace-nowrap">
                Adicionar
              </button>
            </div>
          ) : (
            <select {...register('descricao_id')} className={selectClass}>
              <option value="">Selecione...</option>
              {descricoes.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          )}
          {errors.descricao_id && <p className="text-danger-500 text-xs mt-1">{errors.descricao_id.message}</p>}
        </div>

        {/* Valor + Vencimento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Valor *</label>
            <Controller
              name="valor"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  className={inputClass}
                  placeholder="R$ 0,00"
                  onChange={e => field.onChange(maskCurrency(e.target.value))}
                />
              )}
            />
            {errors.valor && <p className="text-danger-500 text-xs mt-1">{errors.valor.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Vencimento *</label>
            <input type="date" {...register('vencimento')} className={inputClass} />
            {errors.vencimento && <p className="text-danger-500 text-xs mt-1">{errors.vencimento.message}</p>}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-3">Status</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="em_aberto" {...register('status')} className="w-4 h-4 text-primary-600 accent-primary-600" />
              <span>Em Aberto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="pago" {...register('status')} className="w-4 h-4 text-primary-600 accent-primary-600" />
              <span>Pago</span>
            </label>
          </div>
        </div>

        {/* Anexos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-5">
          <div>
            <label className="block text-sm font-medium mb-3">Boleto (PDF ou Imagem)</label>
            <div className="relative group">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => handleFileUpload(e, 'boleto_url')}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <div className={`p-4 border-2 border-dashed ${watch('boleto_url') ? 'border-success-500/50 bg-success-500/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'} rounded-2xl flex flex-col items-center justify-center text-center transition-all group-hover:border-primary-500/50`}>
                {uploading === 'boleto' ? (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : watch('boleto_url') ? (
                  <>
                    <span className="text-2xl mb-1">📄</span>
                    <span className="text-xs font-medium text-success-600">Boleto Selecionado</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setValue('boleto_url', null); }} className="text-[10px] text-danger-500 mt-1 hover:underline relative z-20">Remover</button>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mb-1 text-gray-400 group-hover:scale-110 transition-transform">📤</span>
                    <span className="text-xs text-gray-500">Clique para enviar o boleto</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Comprovante (PDF ou Imagem)</label>
            <div className="relative group">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => handleFileUpload(e, 'comprovante_url')}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={!!uploading}
              />
              <div className={`p-4 border-2 border-dashed ${watch('comprovante_url') ? 'border-success-500/50 bg-success-500/5' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'} rounded-2xl flex flex-col items-center justify-center text-center transition-all group-hover:border-primary-500/50`}>
                {uploading === 'comprovante' ? (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : watch('comprovante_url') ? (
                  <>
                    <span className="text-2xl mb-1">🧾</span>
                    <span className="text-xs font-medium text-success-600">Comprovante Selecionado</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setValue('comprovante_url', null); }} className="text-[10px] text-danger-500 mt-1 hover:underline relative z-20">Remover</button>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mb-1 text-gray-400 group-hover:scale-110 transition-transform">📤</span>
                    <span className="text-xs text-gray-500">Clique para enviar o comprovante</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/contas')} className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
