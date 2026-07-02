// 產品資訊介面
export interface ProductInfo {
  name: string;
  description: string;
  amount: number;
  currency: string;
  displayAmount: string;
  pointsGranted: number;
}

// 訂單資料介面
export interface OrderData {
    _id: string;
    orderReference: string;
    transactionType: string;
    payment: {
      amount: number;
      currency: string;
      status: string;
      paymentDate: string;
      paymentType: string;
    };
    stripe: {
      customerId: string;
      checkoutSessionId: string;
    };
    subscription: {
      cancelAtPeriodEnd: boolean;
      isRenewal: boolean;
    };
    invoice: {
      invoiceNumber: string;
      invoiceDate: string;
      randomNum: string;
      invoiceStatus: string;
    };
    pointsGranted?: number; // 保持向後兼容
    productInfo?: ProductInfo; // 新增產品資訊結構
    description: string;
    createdAt: string;
    updatedAt: string;
    transactionId?: string;
  }