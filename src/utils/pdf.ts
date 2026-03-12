import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from 'dayjs'
import { formatCurrency, formatDate } from './masks'

interface ContaPDFData {
  pessoa: string
  tipo: string
  descricao: string
  valor: number
  vencimento: string
  status: string
  nomeEmpresa?: string
  logoUrl?: string
}

export async function generateContaPDF(data: ContaPDFData): Promise<void> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Try to load logo
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl)
      const imgWidth = 40
      const imgHeight = 20
      doc.addImage(img, 'PNG', (pageWidth - imgWidth) / 2, 10, imgWidth, imgHeight)
    } catch {
      // Skip logo if it fails to load
    }
  }

  // Company name
  const startY = data.logoUrl ? 38 : 20
  if (data.nomeEmpresa) {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.nomeEmpresa, pageWidth / 2, startY, { align: 'center' })
  }

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTA A PAGAR', pageWidth / 2, startY + 12, { align: 'center' })

  // Divider
  doc.setDrawColor(200, 200, 200)
  doc.line(20, startY + 18, pageWidth - 20, startY + 18)

  // Content
  const contentStart = startY + 28
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  const fields = [
    ['Proprietário', data.pessoa],
    ['Tipo', data.tipo],
    ['Descrição', data.descricao],
    ['Valor', formatCurrency(data.valor)],
    ['Vencimento', formatDate(data.vencimento)],
    ['Status', data.status === 'pago' ? 'Pago' : 'Em Aberto'],
  ]

  fields.forEach(([label, value], i) => {
    const y = contentStart + i * 10
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, 25, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 70, y)
  })

  // Footer
  const finalY = contentStart + fields.length * 10 + 15
  doc.setDrawColor(200, 200, 200)
  doc.line(20, finalY, pageWidth - 20, finalY)
  doc.setFontSize(9)
  doc.setTextColor(128, 128, 128)
  doc.text(
    `Documento gerado em ${dayjs().format('DD/MM/YYYY [às] HH:mm')}`,
    pageWidth / 2,
    finalY + 8,
    { align: 'center' }
  )

  const primeiroNome = data.pessoa.trim().split(' ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    
  const dataString = dayjs().format('DD-MM-YYYY')
  const filename = `CONTA_${primeiroNome || 'GERAL'}_${dataString}.pdf`

  doc.save(filename)
}

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
}

export interface RelatorioContasPDFData {
  contas: {
    pessoa: string
    tipo: string
    descricao: string
    valor: number
    vencimento: string
    status: string
  }[]
  filtrosInfo: string
  totalGeral: number
  totalPago: number
  totalAberto: number
  nomeEmpresa?: string
  logoUrl?: string
}

export async function generateRelatorioContasPDF(data: RelatorioContasPDFData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Try to load logo
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl)
      const imgWidth = 40
      const imgHeight = 20
      doc.addImage(img, 'PNG', 14, 10, imgWidth, imgHeight)
    } catch {
      // Skip logo if it fails
    }
  }

  // Company Name
  const hasLogo = !!data.logoUrl
  if (data.nomeEmpresa) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(data.nomeEmpresa, hasLogo ? 60 : 14, hasLogo ? 18 : 18)
  }

  // Report Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Contas a Pagar', hasLogo ? 60 : 14, hasLogo ? 26 : 26)

  // Filters Info
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(data.filtrosInfo, pageWidth - 14, 20, { align: 'right' })

  // Current Date
  doc.text(`Gerado em: ${dayjs().format('DD/MM/YYYY HH:mm')}`, pageWidth - 14, 25, { align: 'right' })

  // Table
  const tableData = data.contas.map(c => [
    c.pessoa,
    c.tipo,
    c.descricao,
    formatCurrency(c.valor),
    formatDate(c.vencimento),
    c.status === 'pago' ? 'Pago' : 'Em Aberto'
  ])

  autoTable(doc, {
    startY: 35,
    head: [['Proprietário', 'Tipo', 'Descrição', 'Valor', 'Vencimento', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [41, 52, 79], textColor: 255, fontStyle: 'bold' }, // Dark blueish
    alternateRowStyles: { fillColor: [248, 250, 252] }, // tailwind slate-50
    styles: { fontSize: 9, cellPadding: 4, textColor: [51, 65, 85] },
    columnStyles: {
      3: { halign: 'right' }, // Valor
      4: { halign: 'center' }, // Vencimento
      5: { halign: 'center' } // Status
    },
    didDrawPage: function (data) {
      // Footer text
      const str = 'Página ' + doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' })
    }
  })

  // Add Totals Block
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  doc.setFillColor(241, 245, 249) // slate-100
  doc.roundedRect(14, finalY, pageWidth - 28, 25, 3, 3, 'F')
  
  doc.setFontSize(10)
  doc.setTextColor(51, 65, 85)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo do Período', 20, finalY + 8)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Total em Aberto:`, 20, finalY + 18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${formatCurrency(data.totalAberto)}`, 50, finalY + 18)
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Pago:`, 90, finalY + 18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${formatCurrency(data.totalPago)}`, 115, finalY + 18)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL GERAL:`, pageWidth - 80, finalY + 16)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text(`${formatCurrency(data.totalGeral)}`, pageWidth - 45, finalY + 16)

  let primeiroNome = 'GERAL'
  if (data.contas.length > 0) {
    const nomeCompleto = data.contas[0].pessoa.trim()
    if (nomeCompleto) {
      primeiroNome = nomeCompleto.split(' ')[0]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
    }
  }
  
  const dataString = dayjs().format('DD-MM-YYYY')
  const filename = `CONTAS_${primeiroNome}_${dataString}.pdf`

  doc.save(filename)
}
