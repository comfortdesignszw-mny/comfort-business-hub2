export interface PaymentRequest {
  phone: string;
  amount: number;
  currency: string;
  reference: string;
  method: 'EcoCash' | 'InnBucks' | 'Paynow' | 'Bank';
}

export async function initiatePayment(req: PaymentRequest) {
  console.log(`Initiating ${req.method} payment for ${req.amount} ${req.currency} to ${req.phone}`);
  
  // Mocking API call to payment gateway
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        transactionId: 'ZW-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        status: 'pending_ussd'
      });
    }, 2000);
  });
}

export async function checkPaymentStatus(transactionId: string) {
  // Mocking status check
  return { status: 'completed' };
}
