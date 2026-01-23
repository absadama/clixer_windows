/**
 * Toast notification hook
 * Tutarlı hata ve başarı mesajları için kullanılır
 * alert() yerine toast kullanarak daha iyi UX sağlar
 */

import toast from 'react-hot-toast'

export const useToast = () => {
  const showSuccess = (message: string) => {
    toast.success(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#fff',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#10B981',
      },
    })
  }

  const showError = (message: string) => {
    toast.error(message, {
      duration: 6000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#fff',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#EF4444',
      },
    })
  }

  const showWarning = (message: string) => {
    toast(message, {
      duration: 5000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
        fontWeight: '500',
      },
    })
  }

  const showInfo = (message: string) => {
    toast(message, {
      duration: 4000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3B82F6',
        color: '#fff',
        fontWeight: '500',
      },
    })
  }

  const showLoading = (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#6366F1',
        color: '#fff',
        fontWeight: '500',
      },
    })
  }

  const dismissToast = (toastId: string) => {
    toast.dismiss(toastId)
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    dismissToast,
  }
}

// Non-hook version for use outside React components
export const toastSuccess = (message: string) => {
  toast.success(message, { duration: 4000, position: 'top-right' })
}

export const toastError = (message: string) => {
  toast.error(message, { duration: 6000, position: 'top-right' })
}

export const toastWarning = (message: string) => {
  toast(message, { duration: 5000, position: 'top-right', icon: '⚠️' })
}

export const toastInfo = (message: string) => {
  toast(message, { duration: 4000, position: 'top-right', icon: 'ℹ️' })
}

export default useToast
