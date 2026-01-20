import { Error } from '@/utils'
import React from 'react'

export function Error({ 
  title, 
  message, 
  onRetry,
  onDismiss 
}: {
  title: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl border-l-2 border-red-200 max-w-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9l1.42-1.42 7L10.59c-1.11-1.42-1.42 2 7C7 6.52-1.42z" />
              </svg>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{title}</p>
            <p className="text-red-700 mt-1">{message}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 mt-4">
          <Button
            onClick={onDismiss}
            variant="outline"
            size="sm"
          >
            Got it
          </Button>
          
          {(onRetry) && (
            <Button
              onClick={onRetry}
              variant="primary"
              size="sm"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Error