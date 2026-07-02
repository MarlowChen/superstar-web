// ModelDetailsModal.tsx
import { AIModel } from './types'
import { X, Palette, Info } from 'lucide-react'

interface ModelDetailsModalProps {
  model: AIModel | null
  onClose: () => void
}

export default function ModelDetailsModal({ model, onClose }: ModelDetailsModalProps) {
  if (!model) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* 頂部導航欄 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mr-3">
              <Palette size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{model.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 模型內容 */}
        <div className="content-scrollbar p-6 max-h-[70vh] overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">描述</h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {model.description}
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">提示信息</h3>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {model.basicSettings.promptMsg}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">技術詳情</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  主模型
                </div>
                <div className="text-gray-900 dark:text-white">{model.basicSettings.mainModel}</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  風格模型
                </div>
                <div className="text-gray-900 dark:text-white">
                  {model.basicSettings.styleModel}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  LoRA 模型
                </div>
                <div className="text-gray-900 dark:text-white">{model.basicSettings.loraModel}</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  SD1.5 模型
                </div>
                <div className="text-gray-900 dark:text-white">{model.basicSettings.sd15Model}</div>
              </div>
            </div>
          </div>

          <div className="mb-3 flex items-center">
            <Info size={16} className="text-gray-500 dark:text-gray-400 mr-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              最後更新於: {new Date(model.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}
