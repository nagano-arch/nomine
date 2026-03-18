import { baseLayout, toastScript, loadingOverlay } from '../shared/layout';

export default function loginPage() {
  return baseLayout(
    'ログイン',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="card max-w-md w-full p-8 fade-in">
            <!-- ロゴ・ブランディング -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-black text-gray-900 mb-2">NOMINE</h1>
                <p class="text-sm text-gray-600">選ばれる一枚を。</p>
            </div>
            
            <!-- ログインフォーム -->
            <form id="login-form" class="space-y-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        メールアドレス
                    </label>
                    <input 
                        type="email" 
                        id="email"
                        name="email"
                        required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        placeholder="your@email.com"
                    >
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        パスワード
                    </label>
                    <div class="relative">
                        <input 
                            type="password" 
                            id="password"
                            name="password"
                            required
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                            placeholder="8文字以上"
                        >
                        <button 
                            type="button"
                            id="toggle-password"
                            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            <i class="fas fa-eye" id="eye-icon"></i>
                        </button>
                    </div>
                </div>
                
                <div class="flex items-center">
                    <input 
                        type="checkbox" 
                        id="remember"
                        class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    >
                    <label for="remember" class="ml-2 text-sm text-gray-600">
                        7日間ログインを保持
                    </label>
                </div>
                
                <button 
                    type="submit"
                    class="w-full gradient-bg text-white font-bold py-3 rounded-lg btn-hover"
                >
                    ログイン
                </button>
            </form>
            
            <!-- 新規登録リンク -->
            <div class="mt-6 text-center">
                <p class="text-sm text-gray-600">
                    アカウントをお持ちでない方は
                    <a href="/admin/register" class="text-purple-600 font-medium hover:text-purple-700">
                        新規登録
                    </a>
                </p>
            </div>
        </div>
    </div>
    
    ${toastScript()}
    
    <script>
    // パスワード表示切替
    document.getElementById('toggle-password').addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        const eyeIcon = document.getElementById('eye-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    });
    
    // ログインフォーム送信
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            showError('メールアドレスとパスワードを入力してください');
            return;
        }
        
        window.showLoading();
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'ログインに失敗しました');
            }
            
            // トークンとユーザー情報を保存
            localStorage.setItem('nomine_token', data.data.token);
            localStorage.setItem('nomine_user', JSON.stringify(data.data.user));
            
            showSuccess('ログインしました');
            
            // ダッシュボードへリダイレクト
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 500);
            
        } catch (error) {
            window.hideLoading();
            showError(error.message);
        }
    });
    
    // 既にログイン済みの場合はダッシュボードへ
    (async function() {
        const token = localStorage.getItem('nomine_token');
        if (token) {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });
                if (response.ok) {
                    window.location.href = '/admin/dashboard';
                }
            } catch (error) {
                // トークンが無効な場合は何もしない
            }
        }
    })();
    </script>
    `
  );
}
