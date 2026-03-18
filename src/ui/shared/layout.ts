/**
 * 共通のベースHTML構造
 */
export function baseLayout(title: string, content: string, additionalHead: string = '') {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${title} - NOMINE</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
        
        * {
            font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        /* カスタムスクロールバー */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        
        /* アニメーション */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        /* ボタンホバーエフェクト */
        .btn-hover {
            transition: all 0.2s ease;
        }
        
        .btn-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        }
        
        .btn-hover:active {
            transform: translateY(0);
        }
        
        /* カード */
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            transition: all 0.3s ease;
        }
        
        .card:hover {
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        /* グラデーション背景 */
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .gradient-gold {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        
        /* ローディング */
        .loading-spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
    ${additionalHead}
</head>
<body class="bg-gray-50">
    ${content}
</body>
</html>
  `;
}

/**
 * トーストメッセージ表示用のJavaScript
 */
export function toastScript() {
  return `
<script>
window.showToast = function(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = \`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 fade-in \${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }\`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showError = function(message) {
    window.showToast(message, 'error');
};

window.showSuccess = function(message) {
    window.showToast(message, 'success');
};
</script>
  `;
}

/**
 * ローディングオーバーレイ
 */
export function loadingOverlay() {
  return `
<div id="loading-overlay" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-white rounded-2xl p-8 flex flex-col items-center">
        <div class="loading-spinner"></div>
        <p class="mt-4 text-gray-700 font-medium">処理中...</p>
    </div>
</div>

<script>
window.showLoading = function() {
    document.getElementById('loading-overlay').classList.remove('hidden');
};

window.hideLoading = function() {
    document.getElementById('loading-overlay').classList.add('hidden');
};
</script>
  `;
}

/**
 * APIリクエストヘルパー
 */
export function apiHelperScript() {
  return `
<script>
// ローカルストレージからトークン取得
window.getAuthToken = function() {
    return localStorage.getItem('nomine_token');
};

// APIリクエストヘルパー
window.apiRequest = async function(url, options = {}) {
    const token = window.getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token && !options.skipAuth) {
        headers['Authorization'] = \`Bearer \${token}\`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'リクエストが失敗しました');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// ログアウト
window.logout = function() {
    localStorage.removeItem('nomine_token');
    localStorage.removeItem('nomine_user');
    window.location.href = '/admin/login';
};

// 認証チェック
window.checkAuth = async function() {
    const token = window.getAuthToken();
    if (!token) {
        window.location.href = '/admin/login';
        return null;
    }
    
    try {
        const data = await window.apiRequest('/api/auth/me');
        localStorage.setItem('nomine_user', JSON.stringify(data.data.user));
        return data.data;
    } catch (error) {
        window.logout();
        return null;
    }
};
</script>
  `;
}
