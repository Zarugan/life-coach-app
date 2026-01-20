// Temporary simplified receipt scanning service to fix build issues
// This is a mock service for demonstration

export interface ReceiptData {
  id: string
  merchant: string
  amount: number
  date: string
  category: string
  items: string[]
  confidence: number
}

export interface ReceiptInsight {
  type: 'warning' | 'tip' | 'suggestion'
  message: string
  confidence: number
}

export class ReceiptScanningService {
  // Mock OCR processing
  async scanReceipt(imageFile: File): Promise<ReceiptData> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Return mock receipt data
    return {
      id: Date.now().toString(),
      merchant: 'Whole Foods',
      amount: 127.43,
      date: new Date().toISOString(),
      category: 'groceries',
      items: ['Organic Vegetables', 'Fruits', 'Protein', 'Dairy'],
      confidence: 0.95
    }
  }

  // Mock AI insights
  async getInsights(receipt: ReceiptData): Promise<ReceiptInsight[]> {
    await new Promise(resolve => setTimeout(resolve, 1000))

    return [
      {
        type: 'tip',
        message: `You spent $${receipt.amount} on ${receipt.category}. Consider meal planning to reduce costs.`,
        confidence: 0.88
      },
      {
        type: 'suggestion', 
        message: 'Look for seasonal produce to save 20-30% on groceries.',
        confidence: 0.92
      }
    ]
  }

  // Mock expense categorization
  categorizeExpense(merchant: string): string {
    const categories: Record<string, string> = {
      'whole foods': 'groceries',
      'trader joe': 'groceries',
      'starbucks': 'dining',
      'mcdonalds': 'dining',
      'target': 'retail',
      'walmart': 'retail'
    }

    const normalized = merchant.toLowerCase()
    for (const [key, value] of Object.entries(categories)) {
      if (normalized.includes(key)) {
        return value
      }
    }
    
    return 'other'
  }
}

// Export singleton instance
export const receiptScanningService = new ReceiptScanningService()