import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  CameraIcon, 
  DocumentIcon, 
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, CardBody, Progress, Modal } from '@/components/ui'
import { formatCurrency, formatDateTime } from '@/utils'

interface Receipt {
  id: string
  merchant: string
  amount: number
  currency: string
  category: string
  date: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    category: string
  }>
  imageUrl?: string
  status: 'processing' | 'completed' | 'failed'
  insights?: Array<{
    type: string
    message: string
    severity: string
  }>
}

export default function Receipts() {
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: receipts, isLoading } = useQuery(
    'receipts',
    () => fetch('/api/receipts').then(res => res.json()),
    {
      staleTime: 1000 * 30 // 30 minutes
    }
  )

  const uploadMutation = useMutation(
    async (imageData: string) => {
      const response = await fetch('/api/receipts/upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData })
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      return result
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('receipts')
        queryClient.invalidateQueries('stats')
        setUploadModalOpen(false)
        
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/receipts/status/${data.jobId}`)
            const statusData = await statusResponse.json()
            
            if (statusData.status === 'completed') {
              clearInterval(pollInterval)
              queryClient.invalidateQueries('receipts')
              queryClient.invalidateQueries('stats')
            }
          } catch (error) {
            clearInterval(pollInterval)
          }
        }, 2000)

        // Auto-stop after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000)
      },
      onError: (error) => {
        console.error('Upload error:', error)
      }
    }
  )

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string
      uploadMutation.mutate(imageData)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string
      uploadMutation.mutate(imageData)
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  const deleteMutation = useMutation(
    async (receiptId: string) => {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      queryClient.invalidateQueries('receipts')
      queryClient.invalidateQueries('stats')
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('receipts')
        queryClient.invalidateQueries('stats')
      }
    }
  )

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      groceries: 'bg-green-100 text-green-800',
      dining: 'bg-orange-100 text-orange-800',
      retail: 'bg-blue-100 text-blue-800',
      gas: 'bg-purple-100 text-purple-800',
      entertainment: 'bg-pink-100 text-pink-800',
      transportation: 'bg-yellow-100 text-yellow-800',
      uncategorized: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <div className="loading-spinner w-5 h-5"></div>
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-success-600" />
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-danger-600" />
      default:
        return <div className="w-5 h-5 bg-neutral-300 rounded-full"></div>
    }
  }

  const totalSpent = receipts?.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) || 0
  const thisMonthSpent = receipts?.filter(receipt => {
    const receiptDate = new Date(receipt.date)
    const now = new Date()
    return receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear()
  }).reduce((sum, receipt) => sum + (receipt.amount || 0), 0) || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Receipts</h1>
          <p className="text-neutral-500 mt-1">Track expenses with AI-powered receipt scanning</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setUploadModalOpen(true)}
            className="btn btn-primary"
          >
            <CameraIcon className="w-5 h-5 mr-2" />
            Scan Receipt
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <DocumentIcon className="w-12 h-12 text-primary-600 mx-auto mb-3" />
              <div className="text-2xl font-bold text-neutral-900">{receipts?.length || 0}</div>
              <p className="text-sm text-neutral-500">Total Receipts</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-primary-600">{formatCurrency(totalSpent)}</div>
              <p className="text-sm text-neutral-500">Total Spent</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-success-600">{formatCurrency(thisMonthSpent)}</div>
              <p className="text-sm text-neutral-500">This Month</p>
          </CardBody>
        </Card>
      </div>

      {/* Upload Area */}
      <Card className={`border-2 border-dashed ${dragActive ? 'border-primary-400 bg-primary-50' : 'border-neutral-300'}`}>
        <CardBody className="text-center py-12">
          <CloudArrowUpIcon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">
            {uploadMutation.isLoading ? 'Processing...' : 'Drop receipt here or click to upload'}
          </h3>
          <p className="text-neutral-500 mb-6">
            AI will automatically scan and categorize expenses
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
                disabled={uploadMutation.isLoading}
              >
                <CameraIcon className="w-5 h-5 mr-2" />
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button className="btn btn-outline">
                View History
              </Button>
          </div>
        </CardBody>
      </Card>

      {/* Drag and drop overlay */}
      <Card 
        className="relative h-96 border-2 border-dashed border-neutral-300"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardBody className="h-full flex flex-col items-center justify-center">
          <CloudArrowUpIcon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-900">
            {dragActive ? 'Drop receipt here' : 'Or drag and drop receipt here'}
          </h3>
          <p className="text-neutral-500">
            Supports JPEG, PNG, HEIC formats
          </p>
        </CardBody>
      </Card>

      {/* Receipts List */}
      <div className="space-y-4">
        {receipts?.map((receipt) => (
          <Card key={receipt.id} className="hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 truncate">{receipt.merchant}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge className={getCategoryColor(receipt.category)}>
                      {receipt.category}
                    </Badge>
                    <span className="text-sm text-neutral-500">{formatDateTime(receipt.date)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <span className="text-lg font-bold text-neutral-900">{formatCurrency(receipt.amount)}</span>
                  </div>
                  {getStatusIcon(receipt.status)}
                </div>
                <div className="flex space-x-2">
                  {receipt.imageUrl && (
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      className="p-2 rounded-md hover:bg-neutral-100"
                    >
                      <EyeIcon className="w-4 h-4 text-neutral-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(receipt.id)}
                    className="p-2 rounded-md hover:bg-neutral-100 text-danger-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            
            {receipt.items && receipt.items.length > 0 && (
              <CardBody>
                <div className="space-y-2">
                  <h4 className="font-medium text-neutral-900 mb-3">Items</h4>
                  {receipt.items.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-neutral-100 last:border-0">
                      <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900">{item.name}</p>
                            <div className="flex items-center space-x-2 text-xs text-neutral-500">
                              <span>{item.quantity}x</span>
                              <span>@{formatCurrency(item.unitPrice)}</span>
                            </div>
                      </div>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                  {receipt.items.length > 3 && (
                    <p className="text-sm text-neutral-500 text-center py-2">
                      +{receipt.items.length - 3} more items
                    </p>
                  )}
                </div>
              </CardBody>
            )}

            {receipt.insights && receipt.insights.length > 0 && (
              <CardBody>
                <h4 className="font-medium text-neutral-900 mb-3">AI Insights</h4>
                <div className="space-y-2">
                  {receipt.insights.map((insight, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        insight.severity === 'high' ? 'border-danger-300 bg-danger-50' :
                        insight.severity === 'medium' ? 'border-warning-300 bg-warning-50' :
                        'border-neutral-300 bg-neutral-50'
                      }`}>
                        <p className="text-sm font-medium mb-1">{insight.message}</p>
                      </div>
                  ))}
                </div>
              </CardBody>
            )}
          </Card>
        ))}
      </div>

      {/* Upload Processing Modal */}
      <Modal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} size="lg">
        <div className="text-center">
          {uploadMutation.isLoading ? (
            <>
              <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">Processing Receipt...</h3>
              <p className="text-neutral-500">Our AI is analyzing your receipt. This usually takes a few seconds.</p>
              <Progress value={75} color="primary" />
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-16 h-16 text-success-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">Receipt Uploaded!</h3>
              <p className="text-neutral-500 mb-6">
                Your receipt has been successfully processed and analyzed.
              </p>
              <Button onClick={() => setUploadModalOpen(false)} className="btn btn-primary">
                Done
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Receipt Detail Modal */}
      <Modal isOpen={!!selectedReceipt} onClose={() => setSelectedReceipt(null)} size="xl">
        {selectedReceipt && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-neutral-900">{selectedReceipt.merchant}</h3>
              <div className="text-right">
                <span className="text-lg font-bold text-neutral-900">{formatCurrency(selectedReceipt.amount)}</span>
                <span className="text-sm text-neutral-500 ml-2">{formatDateTime(selectedReceipt.date)}</span>
              </div>
            </div>
            
            {selectedReceipt.items && (
              <div>
                <h4 className="font-medium text-neutral-900 mb-3">All Items</h4>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-2 text-sm font-semibold text-neutral-700">Item</th>
                        <th className="text-left py-2 text-sm font-semibold text-neutral-700">Qty</th>
                        <th className="text-left py-2 text-sm font-semibold text-neutral-700">Price</th>
                        <th className="text-left py-2 text-sm font-semibold text-neutral-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.items.map((item, index) => (
                        <tr key={index} className="border-b border-neutral-100">
                          <td className="py-3 text-sm text-neutral-900">{item.name}</td>
                          <td className="py-3 text-sm text-neutral-900 text-center">{item.quantity}</td>
                          <td className="py-3 text-sm text-neutral-900">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-3 text-sm font-medium text-neutral-900">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {selectedReceipt.insights && selectedReceipt.insights.length > 0 && (
              <div>
                <h4 className="font-medium text-neutral-900 mb-3">AI Insights</h4>
                <div className="space-y-2">
                  {selectedReceipt.insights.map((insight, index) => (
                      <div key={index} className={`p-3 rounded-lg border ${
                        insight.severity === 'high' ? 'border-danger-300 bg-danger-50' :
                          insight.severity === 'medium' ? 'border-warning-300 bg-warning-50' :
                          'border-neutral-300 bg-neutral-50'
                      }`}>
                        <p className="text-sm font-medium mb-1">{insight.message}</p>
                      </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}