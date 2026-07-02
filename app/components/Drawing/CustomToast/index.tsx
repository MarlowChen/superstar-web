// components/common/Toast.tsx
import { ToastContainer, toast ,Zoom} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Toast 樣式設定
export const toastStyle = {
  background: '#5944FF',
  color: 'white',
  borderRadius: '8px',
  fontSize: '14px',
  padding: '12px 24px',
  margin: '16px',
};

export const errorToastStyle = {
  ...toastStyle,
  background: '#FF4444',
};

// Toast 通知函數
export const showToast = (message: string, isError = false, autoClose = true) => {
  if (!autoClose) {
    // 錯誤提示：持續顯示直到使用者關閉
    toast.error(message, {
      style: errorToastStyle,
      autoClose: false, // 設定為 false 表示不會自動關閉
      closeOnClick: false, // 防止點擊內容時關閉
      draggable: false, // 禁用拖曳功能
      closeButton: true, // 顯示關閉按鈕
      pauseOnHover: true, // 滑鼠懸停時暫停
    });
  }else{
    toast(message, {
      style: isError ? errorToastStyle : toastStyle,
      autoClose: 5000,
    });
  }
};

export const CustomToast = () => {
  return (
    <ToastContainer
      position="top-center"
      hideProgressBar
      closeButton={true}
      transition={Zoom} 
    />
  );
};