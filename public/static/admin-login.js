// 管理画面ログイン

let loginState = {
  loading: false,
  error: null
};

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <!-- Logo & Title -->
        <div class="text-center">
          <h1 class="text-5xl font-bold text-white mb-2" style="letter-spacing: 0.1em;">NOMINE</h1>
          <p class="text-amber-400 text-sm mb-8">選ばれる一枚を。</p>
          <h2 class="text-2xl font-bold text-white">管理画面ログイン</h2>
        </div>

        <!-- Login Form -->
        <div class="bg-white rounded-2xl shadow-2xl p-8">
          <form id="loginForm" onsubmit="handleLogin(event)" class="space-y-6">
            ${loginState.error ? `
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-sm text-red-800">${loginState.error}</p>
              </div>
            ` : ''}

            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <div class="relative">
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  minlength="8"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onclick="togglePasswordVisibility()"
                  class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <i id="passwordIcon" class="fas fa-eye"></i>
                </button>
              </div>
            </div>

            <div class="flex items-center">
              <input
                type="checkbox"
                id="remember"
                class="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
              />
              <label for="remember" class="ml-2 block text-sm text-gray-700">
                7日間ログインを保持
              </label>
            </div>

            <button
              type="submit"
              id="loginBtn"
              class="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              ${loginState.loading ? 'disabled' : ''}
            >
              ${loginState.loading ? `
                <i class="fas fa-spinner fa-spin mr-2"></i>ログイン中...
              ` : 'ログイン'}
            </button>
          </form>

          <div class="mt-6 text-center">
            <a href="#" class="text-sm text-amber-600 hover:text-amber-700 font-medium">
              新規登録はこちら
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center text-gray-400 text-sm">
          <p>© 2024 NOMINE. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const icon = document.getElementById('passwordIcon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  loginState.loading = true;
  loginState.error = null;
  render();
  
  try {
    const response = await axios.post('/api/auth/login', {
      email,
      password
    });
    
    const { token, user } = response.data;
    
    // トークンを保存
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // ダッシュボードへリダイレクト
    window.location.href = '/admin/dashboard';
  } catch (error) {
    console.error('Login error:', error);
    loginState.loading = false;
    loginState.error = error.response?.data?.error || 'ログインに失敗しました';
    render();
  }
}

// 既にログイン済みの場合はダッシュボードへ
const token = localStorage.getItem('auth_token');
if (token) {
  // トークンの有効性を確認
  axios.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(() => {
    window.location.href = '/admin/dashboard';
  })
  .catch(() => {
    // トークンが無効な場合は削除
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    render();
  });
} else {
  render();
}
