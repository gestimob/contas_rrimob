import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { maskCPF, maskPhone, maskCEP, unmaskDigits } from '../utils/masks'

const pessoaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  complemento: z.string().optional(),
})

type PessoaForm = z.infer<typeof pessoaSchema>

export default function PessoaFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const isEdit = !!id && id !== 'novo'

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<PessoaForm>({
    resolver: zodResolver(pessoaSchema),
  })

  const cepValue = watch('cep')

  useEffect(() => {
    if (window.location.pathname.endsWith(`/${id}`) && !window.location.pathname.includes('editar')) {
      setViewOnly(true)
    }
    if (isEdit) loadPessoa()
  }, [id])

  const loadPessoa = async () => {
    const { data } = await supabase.from('pessoas').select('*').eq('id', id).single()
    if (data) {
      reset({
        nome: data.nome || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        email: data.email || '',
        whatsapp: data.whatsapp || '',
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        complemento: data.complemento || '',
      })
    }
  }

  const handleCEPBlur = async () => {
    const cep = unmaskDigits(cepValue || '')
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setValue('logradouro', data.logradouro || '')
        setValue('bairro', data.bairro || '')
        setValue('cidade', data.localidade || '')
        setValue('estado', data.uf || '')
      }
    } catch { /* ignore */ }
  }

  const onSubmit = async (data: PessoaForm) => {
    setLoading(true)
    const payload = {
      ...data,
      cpf: unmaskDigits(data.cpf || ''),
      whatsapp: unmaskDigits(data.whatsapp || ''),
      cep: unmaskDigits(data.cep || ''),
      user_id: user!.id,
    }

    if (isEdit) {
      await supabase.from('pessoas').update(payload).eq('id', id)
    } else {
      await supabase.from('pessoas').insert(payload)
    }
    navigate('/pessoas')
  }

  const inputClass = `w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">
          {viewOnly ? 'Visualizar Proprietário' : isEdit ? 'Editar Proprietário' : 'Novo Proprietário'}
        </h1>
        <button onClick={() => navigate('/pessoas')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          ← Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 space-y-5">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium mb-2">Nome *</label>
          <input {...register('nome')} disabled={viewOnly} className={inputClass} placeholder="Nome completo" />
          {errors.nome && <p className="text-danger-500 text-xs mt-1">{errors.nome.message}</p>}
        </div>

        {/* CPF + RG */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">CPF</label>
            <input
              {...register('cpf')}
              disabled={viewOnly}
              className={inputClass}
              placeholder="000.000.000-00"
              onChange={e => setValue('cpf', maskCPF(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">RG</label>
            <input {...register('rg')} disabled={viewOnly} className={inputClass} placeholder="RG" />
          </div>
        </div>

        {/* Email + WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input {...register('email')} disabled={viewOnly} className={inputClass} placeholder="email@exemplo.com" type="email" />
            {errors.email && <p className="text-danger-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">WhatsApp</label>
            <input
              {...register('whatsapp')}
              disabled={viewOnly}
              className={inputClass}
              placeholder="(00) 00000-0000"
              onChange={e => setValue('whatsapp', maskPhone(e.target.value))}
            />
          </div>
        </div>

        {/* CEP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">CEP</label>
            <input
              {...register('cep')}
              disabled={viewOnly}
              className={inputClass}
              placeholder="00000-000"
              onChange={e => setValue('cep', maskCEP(e.target.value))}
              onBlur={handleCEPBlur}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-2">Logradouro</label>
            <input {...register('logradouro')} disabled={viewOnly} className={inputClass} placeholder="Rua, Av..." />
          </div>
        </div>

        {/* Número + Bairro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Número</label>
            <input {...register('numero')} disabled={viewOnly} className={inputClass} placeholder="Nº" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-2">Bairro</label>
            <input {...register('bairro')} disabled={viewOnly} className={inputClass} placeholder="Bairro" />
          </div>
        </div>

        {/* Cidade + Estado + Complemento */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Cidade</label>
            <input {...register('cidade')} disabled={viewOnly} className={inputClass} placeholder="Cidade" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <input {...register('estado')} disabled={viewOnly} className={inputClass} placeholder="UF" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Complemento</label>
            <input {...register('complemento')} disabled={viewOnly} className={inputClass} placeholder="Apto, Bloco..." />
          </div>
        </div>

        {/* Actions */}
        {!viewOnly && (
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => navigate('/pessoas')} className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-600/25">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}

        {viewOnly && (
          <div className="flex justify-end pt-4">
            <button type="button" onClick={() => navigate(`/pessoas/${id}/editar`)} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors">
              Editar
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
