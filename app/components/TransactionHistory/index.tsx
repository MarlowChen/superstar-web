import React, { useState, useEffect } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

// 定義介面
interface User {
  id: string;
  name: string;
  username: string;
  authProvider: string;
  roles: string[];
  email: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  loginAttempts: number;
}

interface Payment {
  amount: number;
  currency: string;
  status: string;
  paymentDate: string;
  paymentType: string;
}

interface Invoice {
  invoiceNumber?: string;
  invoiceDate?: string;
  randomNum?: string;
}

interface Transaction {
  id: string;
  user: User;
  orderReference: string;
  transactionType: string;
  payment: Payment;
  invoice: Invoice | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  transactionId: string;
}

interface TransactionCardProps {
  transaction: Transaction;
  isOpen: boolean;
  onToggle: () => void;
  onDownload: (id: string) => void;
}

// // 假設這是從API獲取的資料
// const mockTransactions: Transaction[] = [
//   {
//     "id": "6821d06e7fc0d5ed70bb7dd1",
//     "user": {
//       "id": "66d1c242965441f42ac5a3cc",
//       "name": "marlowkent",
//       "username": "marlowkent",
//       "authProvider": "local",
//       "roles": ["admin"],
//       "email": "marlowkent@gmail.com",
//       "createdAt": "2024-08-30T12:59:46.503Z",
//       "updatedAt": "2024-10-19T06:15:34.897Z",
//       "status": "active",
//       "loginAttempts": 0
//     },
//     "orderReference": "PAY_TWD_1747046510313_BHLZVJ",
//     "transactionType": "PLUS",
//     "payment": {
//       "amount": 604,
//       "currency": "TWD",
//       "status": "Completed",
//       "paymentDate": "2025-05-12T10:42:12.397Z",
//       "paymentType": "NewebPay"
//     },
//     "invoice": {
//       "invoiceNumber": "AA-12345678",
//       "invoiceDate": "2025-05-12",
//       "randomNum": "XYZ123"
//     },
//     "description": "",
//     "createdAt": "2025-05-12T10:41:50.330Z",
//     "updatedAt": "2025-05-12T10:42:12.423Z",
//     "transactionId": "25051218421264986"
//   },
//   {
//     "id": "6821d06e7fc0d5ed70bb7dd2",
//     "user": {
//       "id": "66d1c242965441f42ac5a3cc",
//       "name": "marlowkent",
//       "username": "marlowkent",
//       "authProvider": "local",
//       "roles": ["admin"],
//       "email": "marlowkent@gmail.com",
//       "createdAt": "2024-08-30T12:59:46.503Z",
//       "updatedAt": "2024-10-19T06:15:34.897Z",
//       "status": "active",
//       "loginAttempts": 0
//     },
//     "orderReference": "PAY_TWD_1747032510313_AHLZVJ",
//     "transactionType": "PLUS",
//     "payment": {
//       "amount": 604,
//       "currency": "TWD",
//       "status": "Completed",
//       "paymentDate": "2025-04-12T10:42:12.397Z",
//       "paymentType": "NewebPay"
//     },
//     "invoice": {
//       "invoiceNumber": "AA-12345679",
//       "invoiceDate": "2025-04-12",
//       "randomNum": "XYZ124"
//     },
//     "description": "",
//     "createdAt": "2025-04-12T10:41:50.330Z",
//     "updatedAt": "2025-04-12T10:42:12.423Z",
//     "transactionId": "25041218421264987"
//   },
//   {
//     "id": "6821d06e7fc0d5ed70bb7dd3",
//     "user": {
//       "id": "66d1c242965441f42ac5a3cc",
//       "name": "marlowkent",
//       "username": "marlowkent",
//       "authProvider": "local",
//       "roles": ["admin"],
//       "email": "marlowkent@gmail.com",
//       "createdAt": "2024-08-30T12:59:46.503Z",
//       "updatedAt": "2024-10-19T06:15:34.897Z",
//       "status": "active",
//       "loginAttempts": 0
//     },
//     "orderReference": "PAY_TWD_1746032510313_CHLZVJ",
//     "transactionType": "PLUS",
//     "payment": {
//       "amount": 604,
//       "currency": "TWD",
//       "status": "Completed",
//       "paymentDate": "2025-03-12T10:42:12.397Z",
//       "paymentType": "NewebPay"
//     },
//     "invoice": {
//       "invoiceNumber": "AA-12345680",
//       "invoiceDate": "2025-03-12",
//       "randomNum": "XYZ125"
//     },
//     "description": "",
//     "createdAt": "2025-03-12T10:41:50.330Z",
//     "updatedAt": "2025-03-12T10:42:12.423Z",
//     "transactionId": "25031218421264988"
//   },
//   {
//     "id": "6821d06e7fc0d5ed70bb7dd4",
//     "user": {
//       "id": "66d1c242965441f42ac5a3cc",
//       "name": "marlowkent",
//       "username": "marlowkent",
//       "authProvider": "local",
//       "roles": ["admin"],
//       "email": "marlowkent@gmail.com",
//       "createdAt": "2024-08-30T12:59:46.503Z",
//       "updatedAt": "2024-10-19T06:15:34.897Z",
//       "status": "active",
//       "loginAttempts": 0
//     },
//     "orderReference": "PAY_USD_1745032510313_DHLZVJ",
//     "transactionType": "PLUS",
//     "payment": {
//       "amount": 19.99,
//       "currency": "USD",
//       "status": "Completed",
//       "paymentDate": "2025-02-15T08:22:36.397Z",
//       "paymentType": "Stripe"
//     },
//     "invoice": null, // 美國交易沒有發票
//     "description": "國際訂閱付款",
//     "createdAt": "2025-02-15T08:21:15.330Z",
//     "updatedAt": "2025-02-15T08:22:38.423Z",
//     "transactionId": "25021508223648792"
//   }
// ];

// 格式化日期為 YYYY/MM/DD 格式
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

// 檢查是否有發票資訊
const hasInvoiceInfo = (invoice: Invoice | null): boolean => {
  if (!invoice) return false;
  return !!(invoice.invoiceNumber || invoice.invoiceDate || invoice.randomNum);
};

// 交易歷史卡片元件
const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  isOpen,
  onToggle,
  onDownload,
}) => {
  const formattedDate = formatDate(transaction.payment.paymentDate);
  const hasInvoice = hasInvoiceInfo(transaction.invoice);

  return (
    <div className="mb-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 卡片標題列 */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
          onClick={onToggle}
        >
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-800 dark:text-white">
                {formattedDate}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {transaction.transactionId}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="text-sm font-medium text-gray-800 dark:text-white">
                {transaction.payment.currency}{" "}
                {transaction.payment.amount.toFixed(2)}
              </span>
              <div className="flex items-center justify-end">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    transaction.payment.status === "Completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }`}
                >
                  {transaction.payment.status}
                </span>
              </div>
            </div>
            <div className="text-gray-400">
              {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {/* 展開的詳情 */}
        {isOpen && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  交易資訊
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      交易類型：
                    </span>
                    <span className="text-sm text-gray-800 dark:text-white">
                      {transaction.transactionType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      訂單編號：
                    </span>
                    <span className="text-sm text-gray-800 dark:text-white">
                      {transaction.orderReference}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      支付方式：
                    </span>
                    <span className="text-sm text-gray-800 dark:text-white">
                      {transaction.payment.paymentType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      交易日期：
                    </span>
                    <span className="text-sm text-gray-800 dark:text-white">
                      {formattedDate}
                    </span>
                  </div>
                  {transaction.description && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        說明：
                      </span>
                      <span className="text-sm text-gray-800 dark:text-white">
                        {transaction.description}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 只有在有發票資訊時才顯示發票區塊 */}
              {hasInvoice && transaction.invoice && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    發票資訊
                  </h4>
                  <div className="space-y-2">
                    {transaction.invoice.invoiceNumber && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          發票號碼：
                        </span>
                        <span className="text-sm text-gray-800 dark:text-white">
                          {transaction.invoice.invoiceNumber}
                        </span>
                      </div>
                    )}
                    {transaction.invoice.invoiceDate && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          發票日期：
                        </span>
                        <span className="text-sm text-gray-800 dark:text-white">
                          {transaction.invoice.invoiceDate}
                        </span>
                      </div>
                    )}
                    {transaction.invoice.randomNum && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          隨機碼：
                        </span>
                        <span className="text-sm text-gray-800 dark:text-white">
                          {transaction.invoice.randomNum}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 只在有發票時顯示下載按鈕 */}
            {hasInvoice && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => onDownload(transaction.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650 transition-colors duration-200"
                >
                  <Download size={16} />
                  <span>下載發票</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 主要元件
const TransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 模擬從API獲取數據
    const fetchData = async (): Promise<void> => {
      try {
        // 實際環境中這裡應該是從API獲取數據
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/api/transactions`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );
        const data = await res.json();
        if (data && data.docs) {
          setTransactions(data.docs);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleCard = (id: string): void => {
    setOpenCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDownload = (id: string): void => {
    // 實際環境中這裡應該是處理下載發票的邏輯
    console.log(`Downloading invoice for transaction ${id}`);
    // 這裡可以觸發下載發票的API調用
  };

  return (
    <div className="w-full px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            交易歷史記錄
          </h2>

          {loading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">尚無交易記錄</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 grid grid-cols-3 text-sm text-gray-500 dark:text-gray-400 px-4">
                <div>日期</div>
                <div className="text-right col-span-2">金額</div>
              </div>

              {transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  isOpen={!!openCards[transaction.id]}
                  onToggle={() => toggleCard(transaction.id)}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
