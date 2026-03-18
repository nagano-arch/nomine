import { baseLayout, toastScript, loadingOverlay } from '../shared/layout';

export default function registerPage() {
  return baseLayout(
    '新規登録',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="card max-w-md w-full p-8 fade-in">
            <!-- ロゴ・ブランディング -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-black text-gray-900 mb-2">NOMINE</h1>
                <p class="text-sm text-gray-600">選ばれる一枚を。</p>
                <p class="text-xs text-gray-500 mt-2">新規アカウント登録</p>
            </div>
            
            <!-- 登録フォーム -->
            <form id="register-form" class="space-y-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        店舗名 <span class="text-xs text-gray-500">(任意)</span>
                    </label>
                    <input 
                        type="text" 
                        id="name"
                        name="name"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        placeholder="例: 焼肉ダイニング○○"
                    >
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        メールアドレス <span class="text-red-500">*</span>
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
                        パスワード <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <input 
                            type="password" 
                            id="password"
                            name="password"
                            required
                            minlength="8"
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
                    <p class="text-xs text-gray-500 mt-1">8文字以上で入力してください</p>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        パスワード（確認） <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="password" 
                        id="password-confirm"
                        name="password-confirm"
                        required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                        placeholder="もう一度入力してください"
                    >
                </div>
                
                <div class="flex items-start">
                    <input 
                        type="checkbox" 
                        id="terms"
                        required
                        class="w-4 h-4 mt-1 text-purple-600 rounded focus:ring-purple-500"
                    >
                    <label for="terms" class="ml-2 text-xs text-gray-600">
                        利用規約およびプライバシーポリシーに同意します
                    </label>
                </div>
                
                <button 
                    type="submit"
                    class="w-full gradient-bg text-white font-bold py-3 rounded-lg btn-hover"
                >
                    新規登録
                </button>
            </form>
            
            <!-- ログインリンク -->
            <div class="mt-6 text-center">
                <p class="text-sm text-gray-600">
                    既にアカウントをお持ちの方は
                    <a href="/admin/login" class="text-purple-600 font-medium hover:text-purple-700">
                        ログイン
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
    
    // 登録フォーム送信
    document.getElementById('register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password-confirm').value;
        
        // バリデーション
        if (!email || !password) {
            showError('メールアドレスとパスワードを入力してください');
            return;
        }
        
        if (password.length < 8) {
            showError('パスワードは8文字以上で入力してください');
            return;
        }
        
        if (password !== passwordConfirm) {
            showError('パスワードが一致しません');
            return;
        }
        
        window.showLoading();
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || '登録に失敗しました');
            }
            
            // トークンとユーザー情報を保存
            localStorage.setItem('nomine_token', data.data.token);
            localStorage.setItem('nomine_user', JSON.stringify(data.data.user));
            
            showSuccess('登録が完了しました');
            
            // ダッシュボードへリダイレクト
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 500);
            
        } catch (error) {
            window.hideLoading();
            showError(error.message);
        }
    });
    </script>
    `
  );
}
